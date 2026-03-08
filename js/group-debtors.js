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

function goBack() {
  window.location.href = './debtors.html';
}

const groupId = localStorage.getItem('debtGroupId');
const groupName = localStorage.getItem('debtGroupName');

if (!groupId || !groupName) {
  window.location.href = './debtors.html';
}

document.getElementById('groupNameTitle').textContent = `Должники группы ${groupName}`;

async function loadCoursesWithDebts() {
  try {
    const debtsSnapshot = await db.collection("dolg")
      .where("groupId", "==", groupId)
      .where("status", "==", "active")
      .get();

    if (debtsSnapshot.empty) {
      document.getElementById('coursesList').innerHTML = `
        <div class="empty-state">
          <h4>Нет должников</h4>
          <p class="text-muted">В этой группе нет студентов с задолженностями</p>
        </div>
      `;
      return;
    }

    const coursesMap = new Map();

    debtsSnapshot.forEach(doc => {
      const debt = doc.data();
      const courseId = debt.courseId;
      const courseName = debt.courseName;

      if (!coursesMap.has(courseId)) {
        coursesMap.set(courseId, {
          id: courseId,
          name: courseName,
          debtors: []
        });
      }

      coursesMap.get(courseId).debtors.push({
        id: debt.studentId,
        name: debt.studentName,
        debtId: doc.id,
        avgScore: debt.avgScore || 0
      });
    });

    renderCourses(coursesMap);

  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    document.getElementById('coursesList').innerHTML = `
      <div class="empty-state text-danger">
        <h4>Ошибка загрузки данных</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
}

async function resolveDebt(debtId, studentId, courseId) {
  if (!confirm('Снять долг студента?')) return;
  
  try {
    await db.collection("dolg").doc(debtId).update({
      status: 'resolved',
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: localStorage.getItem('teacherId')
    });
    
    loadCoursesWithDebts();
    
  } catch (error) {
    console.error("Ошибка снятия долга:", error);
    alert('Ошибка: ' + error.message);
  }
}

function showCoursePerformance(courseId, courseName) {
  localStorage.setItem('debtGroupId', groupId);
  localStorage.setItem('debtGroupName', groupName);
  localStorage.setItem('debtCourseId', courseId);
  localStorage.setItem('debtCourseName', courseName);
  window.location.href = './course-debtors-performance.html';
}

function renderCourses(coursesMap) {
  const container = document.getElementById('coursesList');
  container.innerHTML = "";

  const sortedCourses = [...coursesMap.entries()].sort((a, b) => 
    a[1].name.localeCompare(b[1].name)
  );

  for (const [courseId, course] of sortedCourses) {
    const courseCard = document.createElement('div');
    courseCard.className = 'course-card';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'course-header';
    headerDiv.innerHTML = `
      <div class="d-flex align-items-center">
        <h4 class="mb-0">${course.name}</h4>
        <button class="btn btn-info btn-sm ml-3 performance-btn" onclick="event.stopPropagation(); showCoursePerformance('${courseId}', '${course.name}')">
          Показать успеваемость
        </button>
      </div>
      <span class="expand-btn" onclick="toggleStudents(this)"> Показать должников</span>
    `;
    courseCard.appendChild(headerDiv);

    const studentsList = document.createElement('div');
    studentsList.className = 'student-list';
    studentsList.style.display = 'none';

    const title = document.createElement('h6');
    title.className = 'mb-3';
    title.innerHTML = '<strong>Студенты с задолженностью:</strong>';
    studentsList.appendChild(title);

    const sortedDebtors = course.debtors.sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    sortedDebtors.forEach(debtor => {
      const studentItem = document.createElement('div');
      studentItem.className = 'student-item';
      
      let scoreClass = 'text-danger';
      let scoreText = 'неуд';
      if (debtor.avgScore >= 60) {
        scoreClass = 'text-warning';
        scoreText = 'удовл';
      }
      
      studentItem.innerHTML = `
        <div>
          <strong>${debtor.name}</strong>
          <br>
          <small class="${scoreClass}">Средний балл: ${debtor.avgScore.toFixed(1)} (${scoreText})</small>
        </div>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); resolveDebt('${debtor.debtId}', '${debtor.id}', '${courseId}')">
          Снять долг
        </button>
      `;
      
      studentsList.appendChild(studentItem);
    });

    courseCard.appendChild(studentsList);
    container.appendChild(courseCard);
  }
}

function toggleStudents(element) {
  const studentsList = element.closest('.course-card').querySelector('.student-list');
  if (studentsList.style.display === 'none') {
    studentsList.style.display = 'block';
    element.textContent = 'Скрыть должников';
  } else {
    studentsList.style.display = 'none';
    element.textContent = ' Показать должников';
  }
}

loadCoursesWithDebts();