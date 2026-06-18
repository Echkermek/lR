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
let courseGrades = null; 


async function loadCourseGrades() {
  try {
    const gradesDoc = await db.collection("course_grades").doc(courseId).get();
    if (gradesDoc.exists) {
      courseGrades = gradesDoc.data();
      console.log("Course grades loaded:", courseGrades);
    } else {
      
      courseGrades = {
        min3: 50,
        min4: 66,
        min5: 77
      };
      console.log("Using default grades:", courseGrades);
    }
  } catch (error) {
    console.error("Error loading course grades:", error);
    courseGrades = { min3: 50, min4: 66, min5: 77 };
  }
}


async function getStudentTotalScore(studentId, studentName) {
  try {
    const docId = `${studentId}_${courseId}`;
    const scoreDoc = await db.collection("student_course_scores").doc(docId).get();
    
    if (scoreDoc.exists) {
      const totalScore = scoreDoc.data().totalScore || 0;
      console.log(`Student ${studentName} totalScore: ${totalScore}`);
      return totalScore;
    } else {
      console.warn(`No student_course_scores found for ${studentName} (${studentId})`);
      return 0;
    }
  } catch (error) {
    console.error(`Error getting totalScore for ${studentName}:`, error);
    return 0;
  }
}


function getGradeFromTotalScore(totalScore) {
  if (!courseGrades) {
    return { text: 'неуд', class: 'bg-unsatisfactory', score: totalScore };
  }
  
  const min3 = courseGrades.min3 || 50;
  const min4 = courseGrades.min4 || 66;
  const min5 = courseGrades.min5 || 77;
  
  if (totalScore >= min5) {
    return { text: 'отл', class: 'bg-excellent', score: totalScore };
  } else if (totalScore >= min4) {
    return { text: 'хор', class: 'bg-good', score: totalScore };
  } else if (totalScore >= min3) {
    return { text: 'удовл', class: 'bg-satisfactory', score: totalScore };
  } else {
    return { text: 'неуд', class: 'bg-unsatisfactory', score: totalScore };
  }
}

async function loadPerformanceData() {
  try {
    
    await loadCourseGrades();
    
    
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
    const studentPromises = [];
    
    debtsSnapshot.forEach(doc => {
      const debt = doc.data();
      studentIds.push(debt.studentId);
      
      
      const studentInfo = {
        id: debt.studentId,
        name: debt.studentName,
        debtDocId: doc.id
      };
      studentsList.push(studentInfo);
      
      
      studentPromises.push(getStudentTotalScore(debt.studentId, debt.studentName));
    });
    
    
    const studentScores = await Promise.all(studentPromises);
    
    
    studentsList.forEach((student, index) => {
      student.totalScore = studentScores[index];
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
    if (allTests.length > 0) {
      const deadlinesSnapshot = await db.collection("deadlines")
        .where("groupId", "==", groupId)
        .where("testId", "in", allTests.map(t => t.id))
        .get();

      deadlinesSnapshot.forEach(doc => {
        const data = doc.data();
        deadlinesMap.set(data.testId, data.deadline);
      });
    }

    
    const gradesMap = new Map();
    for (const test of allTests) {
      if (studentIds.length === 0) continue;
      
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
  
  headerHTML += '<th rowspan="3" style="min-width: 120px;">Общий балл</th>';
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
    
    
    tests.forEach(test => {
      const parts = testPartsMap.get(test.id) || [];
      const key = `${student.id}_${test.id}`;
      const grade = gradesMap.get(key);
      
      if (parts.length) {
        parts.forEach(part => {
          if (grade) { 
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
          row += `<td title="Тест: ${test.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}">${grade.score}</td>`; 
        } else { 
          row += `<td title="Тест: ${test.name}
Статус: Не сдавал">-</td>`; 
        }
      }
    });
    
    
    const totalScore = student.totalScore || 0;
    
    
    const gradeInfo = getGradeFromTotalScore(totalScore);
    
    
    row += `<td class="total-score-cell" title="Общий балл за курс: ${totalScore.toFixed(1)}">${totalScore.toFixed(1)}</td>`;
    
    
    row += `<td class="${gradeInfo.class}" title="Общий балл: ${totalScore.toFixed(1)}
Порог для 3: ${courseGrades?.min3 || 50}
Порог для 4: ${courseGrades?.min4 || 66}
Порог для 5: ${courseGrades?.min5 || 77}">${gradeInfo.text}</td>`;
    
    row += '</tr>';
    tableHTML += row;
  });
  
  tbody.innerHTML = tableHTML;
}


function addCustomStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .total-score-cell {
      font-weight: bold;
      background-color: #f8f9fa;
    }
    .bg-excellent {
      background-color: #28a745 !important;
      color: white !important;
      font-weight: bold;
      text-align: center;
    }
    .bg-good {
      background-color: #17a2b8 !important;
      color: white !important;
      font-weight: bold;
      text-align: center;
    }
    .bg-satisfactory {
      background-color: #ffc107 !important;
      color: #333 !important;
      font-weight: bold;
      text-align: center;
    }
    .bg-unsatisfactory {
      background-color: #dc3545 !important;
      color: white !important;
      font-weight: bold;
      text-align: center;
    }
    .deadline-row th {
      font-size: 0.85rem;
      background-color: #e9ecef;
    }
    .test-part {
      font-size: 0.85rem;
      background-color: #f8f9fa;
    }
    .student-name {
      font-weight: bold;
      background-color: #f8f9fa;
    }
    .info-card {
      margin: 20px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #007bff;
    }
    .back-btn {
      margin: 20px 0 10px 0;
    }
  `;
  document.head.appendChild(style);
}

addCustomStyles();
loadPerformanceData();