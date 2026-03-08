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

const studentId = localStorage.getItem('debtStudentId');
const studentName = localStorage.getItem('debtStudentName');
const groupId = localStorage.getItem('debtGroupId');
const groupName = localStorage.getItem('debtGroupName');

if (!studentId || !groupId) {
  history.back();
}

document.getElementById('studentName').textContent = studentName;
document.getElementById('groupName').textContent = groupName;

let allDebts = [];

async function loadStudentData() {
  try {
    const debtsSnapshot = await db.collection("dolg")
      .where("studentId", "==", studentId)
      .where("groupId", "==", groupId)
      .where("status", "==", "active")
      .get();

    if (debtsSnapshot.empty) {
      document.getElementById('coursesContainer').innerHTML = `
        <div class="empty-state">
          <h4>Нет активных долгов</h4>
          <p class="text-muted">У студента нет задолженностей</p>
        </div>
      `;
      return;
    }

    allDebts = [];
    debtsSnapshot.forEach(doc => {
      allDebts.push({ id: doc.id, ...doc.data() });
    });

    for (const debt of allDebts) {
      await loadCourseData(debt.courseId, debt.courseName);
    }

  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    document.getElementById('coursesContainer').innerHTML = `
      <div class="empty-state text-danger">
        <h4>Ошибка загрузки данных</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
}

async function loadCourseData(courseId, courseName) {
  try {
    const testsSnapshot = await db.collection("test_course")
      .where("courseId", "==", courseId)
      .get();

    if (testsSnapshot.empty) return;

    const tests = [];
    const testPartsMap = new Map();

    for (const doc of testsSnapshot.docs) {
      const testId = doc.data().testId;
      const testDoc = await db.collection("tests").doc(testId).get();
      
      if (testDoc.exists) {
        const testData = testDoc.data();
        tests.push({
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

    tests.sort((a, b) => a.num - b.num);

    const gradesMap = new Map();
    for (const test of tests) {
      const gradesSnapshot = await db.collection("test_grades")
        .where("userId", "==", studentId)
        .where("testId", "==", test.id)
        .get();

      let bestScore = 0;
      let lastDate = null;
      gradesSnapshot.forEach(doc => {
        const grade = doc.data();
        if (grade.bestScore > bestScore) {
          bestScore = grade.bestScore;
          lastDate = grade.timestamp;
        }
      });

      if (bestScore > 0) {
        gradesMap.set(test.id, {
          score: bestScore,
          date: lastDate
        });
      }
    }

    const deadlinesMap = new Map();
    const deadlinesSnapshot = await db.collection("deadlines")
      .where("groupId", "==", groupId)
      .where("testId", "in", tests.map(t => t.id))
      .get();

    deadlinesSnapshot.forEach(doc => {
      const data = doc.data();
      deadlinesMap.set(data.testId, data.deadline);
    });

    renderCourseTable(courseId, courseName, tests, testPartsMap, gradesMap, deadlinesMap);

  } catch (error) {
    console.error(`Ошибка загрузки курса ${courseId}:`, error);
  }
}

function renderCourseTable(courseId, courseName, tests, testPartsMap, gradesMap, deadlinesMap) {
  const container = document.getElementById('coursesContainer');
  
  if (container.children.length === 1 && container.children[0].classList.contains('text-center')) {
    container.innerHTML = '';
  }

  const courseDiv = document.createElement('div');
  courseDiv.className = 'mb-5';
  
  const courseHeader = document.createElement('h5');
  courseHeader.className = 'course-header p-3 mb-3';
  courseHeader.innerHTML = `<strong>${courseName}</strong>`;
  courseDiv.appendChild(courseHeader);

  const tableResponsive = document.createElement('div');
  tableResponsive.className = 'table-responsive';

  const table = document.createElement('table');
  table.className = 'table table-bordered';

  let theadHTML = '<thead>';
  
  theadHTML += '<tr>';
  theadHTML += '<th rowspan="3" style="min-width: 200px;">Студент</th>';
  
  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    const colSpan = parts.length || 1;
    theadHTML += `<th colspan="${colSpan}">${test.name}</th>`;
  });
  
  theadHTML += '<th rowspan="3" style="min-width: 100px;">Оценка</th>';
  theadHTML += '</tr>';
  
  theadHTML += '<tr class="deadline-row">';
  
  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    const colSpan = parts.length || 1;
    const deadline = deadlinesMap.get(test.id);
    const deadlineText = deadline ? deadline : 'Нет срока';
    theadHTML += `<th colspan="${colSpan}" title="Срок сдачи: ${deadlineText}">${deadlineText}</th>`;
  });
  
  theadHTML += '</tr>';
  
  theadHTML += '<tr>';
  
  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    if (parts.length) {
      parts.forEach(p => {
        theadHTML += `<th class="test-part" title="${p.name}">${p.name}</th>`;
      });
    } else {
      theadHTML += '<th class="test-part" title="Тест">Тест</th>';
    }
  });
  
  theadHTML += '</tr>';
  theadHTML += '</thead>';

  let tbodyHTML = '<tbody>';
  
  let totalScore = 0;
  let testsTaken = 0;

  tbodyHTML += '<tr>';
  tbodyHTML += `<td class="student-name" title="${studentName}">${studentName}</td>`;

  tests.forEach(test => {
    const parts = testPartsMap.get(test.id) || [];
    const grade = gradesMap.get(test.id);
    
    if (parts.length) {
      parts.forEach(part => {
        if (grade) { 
          totalScore += grade.score; 
          testsTaken++; 
          tbodyHTML += `<td title="Тест: ${test.name}
Часть: ${part.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}">${grade.score}</td>`; 
        } else { 
          tbodyHTML += `<td title="Тест: ${test.name}
Часть: ${part.name}
Статус: Не сдавал">-</td>`; 
        }
      });
    } else {
      if (grade) { 
        totalScore += grade.score; 
        testsTaken++; 
        tbodyHTML += `<td title="Тест: ${test.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}">${grade.score}</td>`; 
      } else { 
        tbodyHTML += `<td title="Тест: ${test.name}
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
  
  tbodyHTML += `<td class="${gradeClass}" title="Средний балл: ${avg}
Сдано тестов: ${testsTaken} из ${tests.length}">${gradeText}</td>`;
  tbodyHTML += '</tr>';
  tbodyHTML += '</tbody>';

  table.innerHTML = theadHTML + tbodyHTML;
  tableResponsive.appendChild(table);
  courseDiv.appendChild(tableResponsive);
  container.appendChild(courseDiv);
}

loadStudentData();