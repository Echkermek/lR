const firebaseConfig = {
  apiKey: "AIzaSyD2QJQcuUI9lCJP_kqp5tW24J8TN6phPWw",
  authDomain: "prob1-5c047.firebaseapp.com",
  projectId: "prob1-5c047",
  storageBucket: "prob1-5c047.appspot.com",
  messagingSenderId: "1083579621866",
  appId: "1:1083579621866:web:73f214d8fd992f0d52d293"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

if (!localStorage.getItem('teacherId')) {
  window.location.href = './login.html';
}

function logout() {
  localStorage.removeItem('teacherId');
  window.location.href = './login.html';
}

const groupId = localStorage.getItem('debtGroupId');
const groupName = localStorage.getItem('debtGroupName');
const courseId = localStorage.getItem('debtCourseId');
const courseName = localStorage.getItem('debtCourseName');

if (!groupId || !courseId) {
  history.back();
}

document.getElementById('groupNameTitle').textContent = groupName;
document.getElementById('courseNameTitle').textContent = courseName;

let allTests = [];
let testPartsMap = new Map();
let studentsList = [];

async function loadPerformanceData() {
  try {
    const debtsSnapshot = await db.collection("dolg")
      .where("groupId", "==", groupId)
      .where("courseId", "==", courseId)
      .where("status", "==", "active")
      .get();

    if (debtsSnapshot.empty) {
      document.getElementById('performanceTableBody').innerHTML = 
        '<tr><td colspan="100" class="text-center text-muted">Нет должников по этому курсу</td></tr>';
      return;
    }

    const studentIds = [];
    debtsSnapshot.forEach(doc => {
      const debt = doc.data();
      studentIds.push(debt.studentId);
      studentsList.push({
        id: debt.studentId,
        name: debt.studentName
      });
    });

    const testsSnapshot = await db.collection("test_course")
      .where("courseId", "==", courseId)
      .get();

    if (testsSnapshot.empty) {
      document.getElementById('performanceTableBody').innerHTML = 
        '<tr><td colspan="100" class="text-center text-muted">Нет тестов для этого курса</td></tr>';
      return;
    }

    allTests = [];
    for (const doc of testsSnapshot.docs) {
      const testId = doc.data().testId;
      const testDoc = await db.collection("tests").doc(testId).get();
      
      if (testDoc.exists) {
        const testData = testDoc.data();
        allTests.push({
          id: testId,
          name: testData.title || 'Без названия',
          num: testData.num || 0
        });

        const partsSnapshot = await db.collection("tests")
          .doc(testId)
          .collection("parts")
          .orderBy("num")
          .get();

        const parts = [];
        partsSnapshot.forEach(partDoc => {
          const partData = partDoc.data();
          parts.push({
            id: partDoc.id,
            name: partData.title || 'Часть',
            num: partData.num || 0
          });
        });
        testPartsMap.set(testId, parts);
      }
    }

    allTests.sort((a, b) => a.num - b.num);

    const deadlinesMap = new Map();
    const deadlinesSnapshot = await db.collection("deadlines")
      .where("groupId", "==", groupId)
      .where("testId", "in", allTests.map(t => t.id))
      .get();

    deadlinesSnapshot.forEach(doc => {
      const data = doc.data();
      deadlinesMap.set(data.testId, data.deadline);
    });

    const gradesMap = new Map();
    for (const test of allTests) {
      const gradesSnapshot = await db.collection("test_grades")
        .where("testId", "==", test.id)
        .where("userId", "in", studentIds)
        .get();

      gradesSnapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.userId}_${test.id}`;
        
        if (!gradesMap.has(key) || (data.bestScore > gradesMap.get(key).score)) {
          gradesMap.set(key, {
            score: data.bestScore || 0,
            date: data.timestamp
          });
        }
      });
    }

    buildPerformanceTable(studentsList, allTests, gradesMap, deadlinesMap);

  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    document.getElementById('performanceTableBody').innerHTML = 
      '<tr><td colspan="100" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
  }
}

function buildPerformanceTable(students, tests, gradesMap, deadlinesMap) {
  const header = document.getElementById('performanceTableHeader');
  const tbody = document.getElementById('performanceTableBody');
  
  header.innerHTML = '';
  
  if (tests.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="100" class="text-center text-muted">Нет данных</td></tr>'; 
    return; 
  }
  
  let headerHTML = '<tr>';
  headerHTML += '<th rowspan="3" style="min-width: 200px;">Студент</th>';
  
  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    const colSpan = parts.length || 1;
    headerHTML += `<th colspan="${colSpan}">${test.name}</th>`;
  });
  
  headerHTML += '<th rowspan="3" style="min-width: 100px;">Оценка</th>';
  headerHTML += '</tr>';
  
  headerHTML += '<tr class="deadline-row">';
  
  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    const colSpan = parts.length || 1;
    const deadline = deadlinesMap.get(test.id);
    const deadlineText = deadline ? deadline : 'Нет срока';
    headerHTML += `<th colspan="${colSpan}" title="Срок сдачи: ${deadlineText}">${deadlineText}</th>`;
  });
  
  headerHTML += '</tr>';
  
  headerHTML += '<tr>';
  
  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    if (parts.length) {
      parts.forEach(p => {
        headerHTML += `<th class="test-part" title="${p.name}">${p.name}</th>`;
      });
    } else {
      headerHTML += '<th class="test-part" title="Тест">Тест</th>';
    }
  });
  
  headerHTML += '</tr>';
  header.innerHTML = headerHTML;
  
  let tableHTML = '';
  
  students.forEach(student => {
    let row = `<tr><td class="student-name" title="${student.name}">${student.name}</td>`;
    let totalScore = 0;
    let testsTaken = 0;
    
    tests.forEach(test => {
      const parts = testPartsMap.get(test.id) || [];
      const key = `${student.id}_${test.id}`;
      const grade = gradesMap.get(key);
      
      if (parts.length) {
        parts.forEach(part => {
          if (grade) { 
            totalScore += grade.score; 
            testsTaken++; 
            row += `<td title="Тест: ${test.name}
Часть: ${part.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}">${grade.score}</td>`; 
          } else { 
            row += `<td title="Тест: ${test.name}
Часть: ${part.name}
Статус: Не сдавал">-</td>`; 
          }
        });
      } else {
        if (grade) { 
          totalScore += grade.score; 
          testsTaken++; 
          row += `<td title="Тест: ${test.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}">${grade.score}</td>`; 
        } else { 
          row += `<td title="Тест: ${test.name}
Статус: Не сдавал">-</td>`; 
        }
      }
    });
    
    const avg = tests.length ? (totalScore / tests.length).toFixed(1) : '0.0';
    let gradeClass = 'bg-unsatisfactory';
    let gradeText = 'неуд';
    const avgNum = parseFloat(avg);
    
    if (avgNum >= 85) { 
      gradeClass = 'bg-excellent'; 
      gradeText = 'отл'; 
    } else if (avgNum >= 70) { 
      gradeClass = 'bg-good'; 
      gradeText = 'хор'; 
    } else if (avgNum >= 60) { 
      gradeClass = 'bg-satisfactory'; 
      gradeText = 'удовл'; 
    }
    
    row += `<td class="${gradeClass}" title="Средний балл: ${avg}
Сдано тестов: ${testsTaken} из ${tests.length}">${gradeText}</td>`;
    row += '</tr>';
    tableHTML += row;
  });
  
  tbody.innerHTML = tableHTML;
}

loadPerformanceData();