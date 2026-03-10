// Firebase конфигурация
const firebaseConfig = {
  apiKey: "AIzaSyD2QJQcuUI9lCJP_kqp5tW24J8TN6phPWw",
  authDomain: "prob1-5c047.firebaseapp.com",
  projectId: "prob1-5c047",
  storageBucket: "prob1-5c047.appspot.com",
  messagingSenderId: "1083579621866",
  appId: "1:1083579621866:web:73f214d8fd992f0d52d293"
};

// Инициализация Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase инициализирован успешно');
} catch (error) {
  console.error('Ошибка инициализации Firebase:', error);
}

const db = firebase.firestore();
const auth = firebase.auth();

// ========== ОБЩИЕ ФУНКЦИИ ==========

// Проверка авторизации
function checkAuth() {
  const teacherId = localStorage.getItem('teacherId');
  if (!teacherId) {
    console.log('Пользователь не авторизован, перенаправление на login.html');
    window.location.href = './login.html';
    return false;
  }
  return true;
}

// Выход из системы
function logout() {
  console.log('Выход из системы');
  localStorage.removeItem('teacherId');
  localStorage.removeItem('teacherName');
  localStorage.removeItem('teacherSurname');
  localStorage.removeItem('teacherEmail');
  localStorage.removeItem('currentGroupId');
  localStorage.removeItem('currentGroupName');
  localStorage.removeItem('currentCourseId');
  localStorage.removeItem('currentCourseName');
  window.location.href = './login.html';
}

// Форматирование даты
function formatDate(date) {
  if (!date) return 'Неизвестно';
  if (date.toDate) date = date.toDate();
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Генерация случайного кода
function generateRandomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ========== ФУНКЦИИ ДЛЯ LOGIN.HTML ==========

function initLoginPage() {
  console.log('Инициализация страницы входа');
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('loginMessage');
    
    console.log('Попытка входа:', email);
    
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        console.log('Успешная аутентификация:', user.uid);
        return db.collection('teacher').where('login', '==', email).get();
      })
      .then((snapshot) => {
        if (!snapshot.empty) {
          const teacherData = snapshot.docs[0].data();
          localStorage.setItem('teacherId', snapshot.docs[0].id);
          localStorage.setItem('teacherName', teacherData.name);
          localStorage.setItem('teacherSurname', teacherData.surname);
          localStorage.setItem('teacherEmail', teacherData.login);
          
          console.log('Данные преподавателя сохранены:', teacherData.name);
          
          db.collection('teacher').doc(snapshot.docs[0].id).update({
            last_login_time: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          window.location.href = './courses.html';
        } else {
          messageDiv.innerHTML = '<div class="alert alert-danger">Доступ только для преподавателей</div>';
          auth.signOut();
        }
      })
      .catch((error) => {
        console.error("Ошибка входа:", error);
        messageDiv.innerHTML = '<div class="alert alert-danger">Неверный email или пароль</div>';
      });
  });

  auth.onAuthStateChanged((user) => {
    if (user && localStorage.getItem('teacherId')) {
      window.location.href = './courses.html';
    }
  });
}

// ========== ФУНКЦИИ ДЛЯ REGISTER.HTML ==========

function initRegisterPage() {
  console.log('Инициализация страницы регистрации');
  const registerForm = document.getElementById('registerForm');
  if (!registerForm) return;

  registerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const surname = document.getElementById('surname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const inviteCode = document.getElementById('inviteCode').value;
    const messageDiv = document.getElementById('registerMessage');

    console.log('Попытка регистрации:', email);

    db.collection('invite_codes').where('code', '==', inviteCode).get()
      .then((snapshot) => {
        if (snapshot.empty) {
          throw new Error('Неверный код приглашения');
        }
        
        const codeDoc = snapshot.docs[0];
        const codeData = codeDoc.data();
        
        if (codeData.used) {
          throw new Error('Этот код приглашения уже использован');
        }
        
        return auth.createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
            console.log('Пользователь создан в Auth');
            return db.collection('teacher').add({
              name: name,
              surname: surname,
              login: email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              last_login_time: firebase.firestore.FieldValue.serverTimestamp()
            });
          })
          .then((teacherRef) => {
            console.log('Преподаватель добавлен в Firestore');
            return db.collection('invite_codes').doc(codeDoc.id).update({
              used: true,
              usedBy: teacherRef.id,
              usedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
      })
      .then(() => {
        messageDiv.innerHTML = '<div class="alert alert-success">Регистрация успешна! Вы будете перенаправлены на страницу входа.</div>';
        setTimeout(() => {
          window.location.href = './login.html';
        }, 2000);
      })
      .catch((error) => {
        console.error("Ошибка регистрации:", error);
        messageDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
      });
  });
}

// ========== ФУНКЦИИ ДЛЯ COURSES.HTML ==========

let activeCoursesListener = null;
let completedCoursesListener = null;

function initCoursesPage() {
  console.log('Инициализация страницы курсов');
  if (!checkAuth()) return;
  
  // Отображаем имя преподавателя
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    teacherNameEl.textContent = `${name} ${surname}`.trim();
  }
  
  loadActiveCourses();
  loadCompletedCourses();
}

function loadActiveCourses() {
  console.log('Загрузка активных курсов');
  if (activeCoursesListener) activeCoursesListener();
  
  activeCoursesListener = db.collection('courses')
    .orderBy('name')
    .onSnapshot(snap => {
      console.log('Получены данные курсов, количество:', snap.size);
      const activeCourses = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.completed) {
          activeCourses.push({ id: doc.id, ...data });
        }
      });
      console.log('Активных курсов:', activeCourses.length);
      renderCourses(activeCourses, 'activeCoursesList', false);
    }, error => {
      console.error("Ошибка загрузки активных курсов:", error);
      document.getElementById('activeCoursesList').innerHTML = `
        <div class="col-12">
          <div class="empty-state">
            <p class="text-danger">Ошибка загрузки данных: ${error.message}</p>
          </div>
        </div>
      `;
    });
}

function loadCompletedCourses() {
  console.log('Загрузка завершенных курсов');
  if (completedCoursesListener) completedCoursesListener();
  
  completedCoursesListener = db.collection('courses')
    .orderBy('name')
    .onSnapshot(snap => {
      console.log('Получены данные завершенных курсов');
      const completedCourses = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.completed === true) {
          completedCourses.push({ id: doc.id, ...data });
        }
      });
      console.log('Завершенных курсов:', completedCourses.length);
      renderCourses(completedCourses, 'completedCoursesList', true);
    }, error => {
      console.error("Ошибка загрузки завершенных курсов:", error);
      document.getElementById('completedCoursesList').innerHTML = `
        <div class="col-12">
          <div class="empty-state">
            <p class="text-danger">Ошибка загрузки данных: ${error.message}</p>
          </div>
        </div>
      `;
    });
}

async function renderCourses(courses, containerId, isCompleted) {
  const list = document.getElementById(containerId);
  if (!list) {
    console.error('Контейнер не найден:', containerId);
    return;
  }
  
  list.innerHTML = '';
  
  if (courses.length === 0) {
    list.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <p>${isCompleted ? 'Нет завершенных курсов' : 'Нет активных курсов'}</p>
        </div>
      </div>
    `;
    return;
  }
  
  for (const course of courses) {
    try {
      const courseGroupsSnap = await db.collection("course_groups")
        .where("courseId", "==", course.id)
        .get();
      
      // Используем Map для уникальных групп
      const assignedGroupsMap = new Map();
      
      for (const courseGroupDoc of courseGroupsSnap.docs) {
        const courseGroupData = courseGroupDoc.data();
        const groupId = courseGroupData.groupId;
        
        if (!assignedGroupsMap.has(groupId)) {
          const groupDoc = await db.collection("groups").doc(groupId).get();
          
          if (groupDoc.exists) {
            assignedGroupsMap.set(groupId, {
              name: groupDoc.data().name,
              semester: courseGroupData.semester
            });
          }
        }
      }
      
      const assignedGroups = Array.from(assignedGroupsMap.values());
      
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4 mb-3';
      
      let groupsHTML = '';
      if (assignedGroups.length > 0) {
        assignedGroups.forEach(group => {
          groupsHTML += `<span class="badge badge-info mr-1 mb-1">${group.name} (сем. ${group.semester})</span>`;
        });
      } else {
        groupsHTML = '<small class="text-muted">Группы не назначены</small>';
      }
      
      const completedBadge = isCompleted ? '<span class="badge badge-secondary ml-2">Завершен</span>' : '';
      
      col.innerHTML = `
        <div class="card course-card ${isCompleted ? 'bg-light' : ''}">
          <div class="card-body">
            <h5 class="card-title">
              ${course.name}
              ${completedBadge}
            </h5>
            <div class="mb-2">
              ${groupsHTML}
            </div>
            <a href="course_details.html?id=${course.id}" class="btn btn-${isCompleted ? 'secondary' : 'primary'} btn-block">
              ${isCompleted ? 'Просмотр курса' : 'Открыть курс'}
            </a>
          </div>
        </div>
      `;
      list.appendChild(col);
      
    } catch (error) {
      console.error(`Ошибка загрузки групп для курса ${course.id}:`, error);
    }
  }
}

function addCourse() {
  const nameInput = document.getElementById('newCourse');
  const messageDiv = document.getElementById('addCourseMessage');
  
  if (!nameInput) return;
  
  const name = nameInput.value.trim();
  if (!name) {
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-warning">Введите название курса</div>';
    return;
  }
  
  console.log('Добавление курса:', name);
  
  db.collection('courses').add({ 
    name, 
    completed: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp() 
  }).then(() => {
    nameInput.value = '';
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-success">Курс успешно добавлен</div>';
    setTimeout(() => {
      if (messageDiv) messageDiv.innerHTML = '';
    }, 3000);
  }).catch(error => {
    console.error('Ошибка создания курса:', error);
    if (messageDiv) messageDiv.innerHTML = `<div class="alert alert-danger">Ошибка создания курса: ${error.message}</div>`;
  });
}

// ========== ФУНКЦИИ ДЛЯ GROUPS.HTML ==========

function initGroupsPage() {
  console.log('Инициализация страницы групп');
  if (!checkAuth()) return;
  
  // Отображаем имя преподавателя
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    teacherNameEl.textContent = `${name} ${surname}`.trim();
  }
  
  loadGroups();
}

function loadGroups() {
  console.log('Загрузка групп');
  const groupsList = document.getElementById('groupsList');
  
  db.collection("groups").orderBy("name").onSnapshot(snap => {
    console.log('Получены данные групп, количество:', snap.size);
    
    if (!groupsList) return;
    
    if (snap.empty) {
      groupsList.innerHTML = '<div class="empty-state">Нет групп</div>';
      return;
    }
    
    // Используем Map для уникальных групп
    const uniqueGroupsMap = new Map();
    snap.forEach(doc => {
      if (!uniqueGroupsMap.has(doc.id)) {
        uniqueGroupsMap.set(doc.id, doc.data());
      }
    });
    
    let html = '<div class="list-group">';
    uniqueGroupsMap.forEach((group, id) => {
      html += `
        <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
          <span onclick="showGroupCourses('${id}', '${group.name}')" style="cursor: pointer; flex-grow: 1;">
            ${group.name}
          </span>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteGroup('${id}')">
            Удалить
          </button>
        </div>
      `;
    });
    html += '</div>';
    
    groupsList.innerHTML = html;
  }, error => {
    console.error("Ошибка загрузки групп:", error);
    if (groupsList) {
      groupsList.innerHTML = `<div class="alert alert-danger">Ошибка загрузки групп: ${error.message}</div>`;
    }
  });
}

function addGroup() {
  const nameInput = document.getElementById("newGroupName");
  const messageDiv = document.getElementById('addGroupMessage');
  
  if (!nameInput) return;
  
  const name = nameInput.value.trim();
  if (!name) {
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-warning">Введите название группы</div>';
    return;
  }
  
  console.log('Добавление группы:', name);
  
  db.collection("groups").add({
    name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    nameInput.value = "";
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-success">Группа успешно добавлена</div>';
    setTimeout(() => {
      if (messageDiv) messageDiv.innerHTML = '';
    }, 3000);
  }).catch(error => {
    console.error("Ошибка создания группы:", error);
    if (messageDiv) messageDiv.innerHTML = `<div class="alert alert-danger">Ошибка создания группы: ${error.message}</div>`;
  });
}

function deleteGroup(id) {
  if (confirm("Вы уверены, что хотите удалить эту группу?")) {
    db.collection("groups").doc(id).delete()
      .then(() => {
        console.log('Группа удалена');
      })
      .catch(error => {
        console.error("Ошибка удаления группы:", error);
        alert("Ошибка удаления группы: " + error.message);
      });
  }
}

function showGroupCourses(groupId, groupName) {
  console.log('Переход к курсам группы:', groupName);
  localStorage.setItem('currentGroupId', groupId);
  localStorage.setItem('currentGroupName', groupName);
  window.location.href = './group-courses.html';
}

// ========== ФУНКЦИИ ДЛЯ GROUP-COURSES.HTML ==========

function initGroupCoursesPage() {
  console.log('Инициализация страницы курсов группы');
  if (!checkAuth()) return;
  
  // Отображаем имя преподавателя
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    teacherNameEl.textContent = `${name} ${surname}`.trim();
  }
  
  const groupId = localStorage.getItem('currentGroupId');
  const groupName = localStorage.getItem('currentGroupName');
  
  console.log('ID группы:', groupId);
  console.log('Название группы:', groupName);
  
  if (!groupId || !groupName) {
    console.error('Данные группы не найдены');
    window.location.href = './groups.html';
    return;
  }
  
  const titleEl = document.getElementById('groupNameTitle');
  if (titleEl) titleEl.textContent = groupName;
  
  loadGroupCourses(groupId);
}

async function loadGroupCourses(groupId) {
  const coursesList = document.getElementById('coursesList');
  if (!coursesList) return;
  
  coursesList.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="sr-only">Загрузка...</span></div><p class="mt-2">Загрузка курсов...</p></div>';
  
  try {
    console.log('Загрузка курсов для группы:', groupId);
    
    const courseGroupsSnapshot = await db.collection("course_groups")
      .where("groupId", "==", groupId)
      .get();

    console.log('Найдено записей course_groups:', courseGroupsSnapshot.size);

    if (courseGroupsSnapshot.empty) {
      coursesList.innerHTML = '<p class="text-center text-muted">У этой группы нет курсов</p>';
      return;
    }

    // Используем Map для уникальных курсов по courseId
    const uniqueCoursesMap = new Map();
    
    for (const doc of courseGroupsSnapshot.docs) {
      const data = doc.data();
      const courseId = data.courseId;
      
      // Если курс уже есть в Map, пропускаем (оставляем только первую запись)
      if (!uniqueCoursesMap.has(courseId)) {
        const semester = data.semester || 'Не указан';
        
        console.log('Загрузка курса:', courseId);
        
        const courseDoc = await db.collection("courses").doc(courseId).get();
        
        if (courseDoc.exists) {
          const courseData = courseDoc.data();
          const courseName = courseData.name || 'Без названия';
          const isCompleted = courseData.completed || false;
          
          uniqueCoursesMap.set(courseId, {
            id: courseId,
            name: courseName,
            semester: semester,
            isCompleted: isCompleted
          });
        } else {
          console.warn('Курс не найден:', courseId);
        }
      } else {
        console.log('Дублирующаяся запись курса пропущена:', courseId);
      }
    }

    coursesList.innerHTML = '';
    
    if (uniqueCoursesMap.size === 0) {
      coursesList.innerHTML = '<p class="text-center text-muted">Не удалось загрузить курсы</p>';
      return;
    }
    
    // Преобразуем Map в массив и сортируем по названию
    const sortedCourses = Array.from(uniqueCoursesMap.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    sortedCourses.forEach(course => {
      const courseItem = document.createElement('div');
      courseItem.className = 'card mb-3 course-item';
      courseItem.style.cursor = 'pointer';
      courseItem.onclick = () => showCoursePerformance(course.id, course.name);
      
      courseItem.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h5 class="card-title mb-1">${course.name}</h5>
              <p class="card-text text-muted">
                <small>Семестр: ${course.semester}</small>
                ${course.isCompleted ? '<br><small class="text-secondary">Курс завершен</small>' : ''}
              </p>
            </div>
            <span class="badge badge-info">Подробнее →</span>
          </div>
        </div>
      `;
      
      coursesList.appendChild(courseItem);
    });
    
    // Если были дубликаты, показываем предупреждение
    if (courseGroupsSnapshot.size > uniqueCoursesMap.size) {
      console.warn(`Обнаружено ${courseGroupsSnapshot.size - uniqueCoursesMap.size} дублирующихся записей курсов`);
    }
    
  } catch (error) {
    console.error("Ошибка загрузки курсов:", error);
    coursesList.innerHTML = `<p class="text-center text-danger">Ошибка: ${error.message}</p>`;
  }
}

function showCoursePerformance(courseId, courseName) {
  console.log('Переход к курсу:', courseName);
  localStorage.setItem('currentCourseId', courseId);
  localStorage.setItem('currentCourseName', courseName);
  window.location.href = './course-performance.html';
}

/// ========== ФУНКЦИИ ДЛЯ COURSE-PERFORMANCE.HTML ==========

let currentGroupId = null;
let currentGroupName = null;
let currentCourseId = null;
let currentCourseName = null;
let allTests = [];
let allStudents = [];
let testPartsMap = new Map();
let resetData = {};

function initCoursePerformancePage() {
  console.log('Инициализация страницы успеваемости');
  if (!checkAuth()) return;
  
  // Отображаем имя преподавателя
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    teacherNameEl.textContent = `${name} ${surname}`.trim();
  }
  
  currentGroupId = localStorage.getItem('currentGroupId');
  currentGroupName = localStorage.getItem('currentGroupName');
  currentCourseId = localStorage.getItem('currentCourseId');
  currentCourseName = localStorage.getItem('currentCourseName');
  
  console.log('Группа:', currentGroupName);
  console.log('Курс:', currentCourseName);
  
  if (!currentGroupId || !currentCourseId) {
    console.error('Данные группы или курса не найдены');
    window.location.href = './groups.html';
    return;
  }
  
  const groupTitle = document.getElementById('groupNameTitle');
  const courseTitle = document.getElementById('courseNameTitle');
  
  if (groupTitle) groupTitle.textContent = currentGroupName;
  if (courseTitle) courseTitle.textContent = currentCourseName;
  
  loadPerformanceData();
  
  const deadlineForm = document.getElementById('deadlineForm');
  if (deadlineForm) {
    deadlineForm.addEventListener('submit', handleDeadlineSubmit);
  }
  
  const transferForm = document.getElementById('transferForm');
  if (transferForm) {
    transferForm.addEventListener('submit', handleTransferSubmit);
  }
}

async function loadPerformanceData() {
  const tbody = document.getElementById('performanceTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="100" class="text-center">Загрузка...</td></tr>';
  
  try {
    const groupSnapshot = await db.collection("usersgroup")
      .where("groupId", "==", currentGroupId)
      .get();
    
    if (groupSnapshot.empty) { 
      tbody.innerHTML = '<tr><td colspan="100" class="text-center text-muted">В группе нет студентов</td></tr>'; 
      return; 
    }
    
    const studentIds = [];
    groupSnapshot.forEach(doc => {
      const data = doc.data();
      studentIds.push(data.userId);
    });
    
    const studentDocs = await Promise.all(
      studentIds.map(userId => db.collection("users").doc(userId).get())
    );
    
    allStudents = [];
    studentDocs.forEach(doc => {
      if (doc.exists) {
        const userData = doc.data();
        allStudents.push({ 
          id: doc.id, 
          name: userData.name || 'Неизвестный', 
          surname: userData.surname || '' 
        });
      }
    });
    
    // Запрос тестов курса
    const testCourseSnapshot = await db.collection("test_course")
      .where("courseId", "==", currentCourseId)
      .get();
    
    if (testCourseSnapshot.empty) { 
      tbody.innerHTML = '<tr><td colspan="100" class="text-center text-muted">Нет тестов для этого курса</td></tr>'; 
      return; 
    }
    
    // ИСПРАВЛЕНИЕ: Используем Map для уникальных тестов
    const uniqueTestsMap = new Map();
    
    for (const doc of testCourseSnapshot.docs) {
      const data = doc.data();
      const testId = data.testId;
      
      // Добавляем только если такого testId еще нет
      if (!uniqueTestsMap.has(testId)) {
        const testDoc = await db.collection("tests").doc(testId).get();
        if (testDoc.exists) {
          const testData = testDoc.data();
          uniqueTestsMap.set(testId, { 
            id: testId, 
            name: testData.title || 'Без названия', 
            num: testData.num || 0 
          });
        }
      }
    }
    
    // Преобразуем Map в массив и сортируем
    allTests = Array.from(uniqueTestsMap.values()).sort((a, b) => a.num - b.num);
    
    console.log('Загружено уникальных тестов:', allTests.length);
    console.log('Всего записей test_course:', testCourseSnapshot.size);
    
    await loadTestParts();
    // Загружаем дедлайны только для этой группы
    const deadlinesMap = await loadDeadlinesForGroup(currentGroupId);
    const gradesMap = await loadTestGrades(studentIds);
    
    buildPerformanceTable(allStudents, allTests, gradesMap, deadlinesMap);
    populateForms();
    
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    tbody.innerHTML = '<tr><td colspan="100" class="text-center text-danger">Ошибка загрузки данных</td></tr>';
  }
}

// Функция для загрузки дедлайнов только для конкретной группы
async function loadDeadlinesForGroup(groupId) {
  const deadlinesMap = new Map();
  try {
    const snapshot = await db.collection("deadlines")
      .where("groupId", "==", groupId)
      .get();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      deadlinesMap.set(data.testId, data.deadline);
    });
  } catch (error) {
    console.error("Ошибка загрузки дедлайнов:", error);
  }
  return deadlinesMap;
}

// Сохраняем старую функцию для обратной совместимости
async function loadDeadlines() {
  return loadDeadlinesForGroup(currentGroupId);
}

async function loadTestParts() {
  testPartsMap.clear();
  for (const test of allTests) {
    try {
      const partsSnapshot = await db.collection("tests")
        .doc(test.id)
        .collection("parts")
        .orderBy("num")
        .get();
      
      const parts = [];
      partsSnapshot.forEach(doc => {
        const partData = doc.data();
        parts.push({ 
          id: doc.id, 
          name: partData.title || 'Часть', 
          num: partData.num || 0 
        });
      });
      
      testPartsMap.set(test.id, parts);
    } catch { 
      testPartsMap.set(test.id, []); 
    }
  }
}

async function loadTestGrades(studentIds) {
  const gradesMap = new Map();
  try {
    // Загружаем оценки для каждого уникального теста
    const allGrades = await Promise.all(
      allTests.map(test => 
        db.collection("test_grades")
          .where("testId", "==", test.id)
          .where("userId", "in", studentIds)
          .get()
      )
    );
    
    allGrades.forEach((snap, i) => {
      const testId = allTests[i].id;
      snap.forEach(doc => {
        const data = doc.data();
        const key = `${data.userId}_${testId}`;
        
        // Сохраняем только лучший результат для каждого студента и теста
        if (!gradesMap.has(key) || (data.bestScore > gradesMap.get(key).score)) {
          gradesMap.set(key, { 
            score: data.bestScore || 0, 
            date: data.timestamp,
            docId: doc.id
          });
        }
      });
    });
  } catch (error) {
    console.error("Ошибка загрузки оценок:", error);
  }
  return gradesMap;
}

function buildPerformanceTable(students, tests, gradesMap, deadlinesMap) {
  const header = document.getElementById('performanceTableHeader');
  const tbody = document.getElementById('performanceTableBody');
  
  if (!header || !tbody) return;
  
  header.innerHTML = '';
  
  if (tests.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="100" class="text-center text-muted">Нет данных</td></tr>'; 
    return; 
  }
  
  // Проверяем, есть ли у тестов части
  let hasParts = false;
  for (const test of tests) {
    const parts = testPartsMap.get(test.id) || [];
    if (parts.length > 0) {
      hasParts = true;
      break;
    }
  }
  
  let headerHTML = '<tr>';
  
  if (hasParts) {
    // Если есть части, показываем их
    headerHTML += '<th rowspan="3" style="min-width: 200px;">Студент</th>';
    
    tests.forEach(test => {
      const parts = testPartsMap.get(test.id) || [];
      // Если у теста нет частей, показываем одну колонку
      const colSpan = parts.length > 0 ? parts.length : 1;
      headerHTML += `<th colspan="${colSpan}">${test.name}</th>`;
    });
    
    headerHTML += '<th rowspan="3" style="min-width: 100px;">Оценка</th>';
    headerHTML += '</tr>';
    
    // Строка с дедлайнами
    headerHTML += '<tr class="deadline-row">';
    tests.forEach(test => {
      const parts = testPartsMap.get(test.id) || [];
      const colSpan = parts.length > 0 ? parts.length : 1;
      const deadline = deadlinesMap.get(test.id);
      const deadlineText = deadline ? deadline : 'Нет срока';
      headerHTML += `<th colspan="${colSpan}" title="Срок сдачи: ${deadlineText}">${deadlineText}</th>`;
    });
    headerHTML += '</tr>';
    
    // Строка с названиями частей
    headerHTML += '<tr>';
    tests.forEach(test => {
      const parts = testPartsMap.get(test.id) || [];
      if (parts.length > 0) {
        parts.forEach(p => {
          headerHTML += `<th class="test-part" title="${p.name}">${p.name}</th>`;
        });
      } else {
        headerHTML += `<th class="test-part" title="${test.name}">Тест</th>`;
      }
    });
    headerHTML += '</tr>';
  } else {
    // Если у тестов нет частей, показываем простую таблицу
    headerHTML += '<th>Студент</th>';
    tests.forEach(test => {
      headerHTML += `<th>${test.name}</th>`;
    });
    headerHTML += '<th>Оценка</th>';
    headerHTML += '</tr>';
    
    // Добавляем строку с дедлайнами
    headerHTML += '<tr class="deadline-row">';
    headerHTML += '<th></th>';
    tests.forEach(test => {
      const deadline = deadlinesMap.get(test.id);
      const deadlineText = deadline ? deadline : 'Нет срока';
      headerHTML += `<th title="Срок сдачи: ${deadlineText}">${deadlineText}</th>`;
    });
    headerHTML += '<th></th>';
    headerHTML += '</tr>';
  }
  
  header.innerHTML = headerHTML;
  
  // Построение тела таблицы
  let tableHTML = '';
  
  students.forEach(student => {
    let row = `<tr><td class="student-name" title="${student.name} ${student.surname}">${student.name} ${student.surname}</td>`;
    let totalScore = 0;
    let testsTaken = 0;
    
    tests.forEach(test => {
      const parts = testPartsMap.get(test.id) || [];
      const key = `${student.id}_${test.id}`;
      const grade = gradesMap.get(key);
      
      if (hasParts && parts.length > 0) {
        // Если есть части, показываем оценку в каждой части
        parts.forEach((part) => {
          if (grade) { 
            totalScore += grade.score; 
            testsTaken++; 
            row += `<td onclick="showResetModal('${student.id}', '${student.name} ${student.surname}', '${test.id}', '${test.name}', '${part.name}', ${grade.score}, '${grade.docId}')" 
                      title="Тест: ${test.name}
Часть: ${part.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}
Кликните для сброса попытки">${grade.score}</td>`; 
          } else { 
            row += `<td title="Тест: ${test.name}
Часть: ${part.name}
Статус: Не сдавал">-</td>`; 
          }
        });
      } else {
        // Если нет частей, показываем одну колонку для теста
        if (grade) { 
          totalScore += grade.score; 
          testsTaken++; 
          row += `<td onclick="showResetModal('${student.id}', '${student.name} ${student.surname}', '${test.id}', '${test.name}', 'Тест', ${grade.score}, '${grade.docId}')" 
                    title="Тест: ${test.name}
Баллы: ${grade.score}
Дата: ${grade.date ? new Date(grade.date.seconds * 1000).toLocaleDateString('ru-RU') : 'Неизвестно'}
Кликните для сброса попытки">${grade.score}</td>`; 
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

function showResetModal(studentId, studentName, testId, testName, partName, currentScore, gradeDocId) {
  resetData = {
    studentId: studentId,
    studentName: studentName,
    testId: testId,
    testName: testName,
    partName: partName,
    currentScore: currentScore,
    gradeDocId: gradeDocId
  };
  
  const studentEl = document.getElementById('resetStudentName');
  const testEl = document.getElementById('resetTestName');
  const partEl = document.getElementById('resetPartName');
  const scoreEl = document.getElementById('resetCurrentScore');
  
  if (studentEl) studentEl.textContent = studentName;
  if (testEl) testEl.textContent = testName;
  if (partEl) partEl.textContent = partName;
  if (scoreEl) scoreEl.textContent = currentScore;
  
  $('#resetAttemptModal').modal('show');
}

async function confirmResetAttempt() {
  const confirmBtn = document.getElementById('confirmResetBtn');
  if (!confirmBtn) return;
  
  const originalText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Сброс...';
  confirmBtn.disabled = true;

  try {
    if (resetData.gradeDocId) {
      await db.collection("test_grades").doc(resetData.gradeDocId).delete();
    } else {
      const gradesSnapshot = await db.collection("test_grades")
        .where("userId", "==", resetData.studentId)
        .where("testId", "==", resetData.testId)
        .get();
      
      const deletePromises = [];
      gradesSnapshot.forEach(doc => {
        deletePromises.push(db.collection("test_grades").doc(doc.id).delete());
      });
      
      await Promise.all(deletePromises);
    }

    $('#resetAttemptModal').modal('hide');
    await loadPerformanceData();
    alert('Попытка успешно сброшена');

  } catch (error) {
    console.error("Ошибка сброса попытки:", error);
    alert('Ошибка сброса попытки: ' + error.message);
  } finally {
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

function populateForms() {
  const testSelect = document.getElementById('testSelect');
  if (testSelect) {
    testSelect.innerHTML = '<option value="">Выберите тест</option>';
    // Используем allTests (уже уникальные тесты)
    allTests.forEach(t => {
      testSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
  }
  
  const studentSelect = document.getElementById('studentSelect');
  if (studentSelect) {
    studentSelect.innerHTML = '<option value="">Выберите студента</option>';
    allStudents.forEach(s => {
      studentSelect.innerHTML += `<option value="${s.id}">${s.name} ${s.surname}</option>`;
    });
  }
  
  db.collection("groups").get().then(snap => {
    const groupSelect = document.getElementById('groupSelect');
    if (!groupSelect) return;
    
    groupSelect.innerHTML = '<option value="">Выберите группу</option>';
    snap.forEach(doc => {
      if (doc.id !== currentGroupId) {
        groupSelect.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
      }
    });
  });
}

async function handleDeadlineSubmit(e) {
  e.preventDefault();
  
  const testSelect = document.getElementById('testSelect');
  const deadlineDate = document.getElementById('deadlineDate');
  
  // Получаем данные из глобальных переменных или из localStorage
  const groupId = currentGroupId || localStorage.getItem('currentGroupId');
  const groupName = currentGroupName || localStorage.getItem('currentGroupName');
  
  console.log('Debug - handleDeadlineSubmit:', {
    groupId,
    groupName,
    currentGroupId,
    currentGroupName
  });
  
  if (!testSelect || !deadlineDate) {
    console.error('Элементы формы не найдены');
    return;
  }
  
  const testId = testSelect.value;
  const dateString = deadlineDate.value;
  
  if (!testId || !dateString) {
    alert('Пожалуйста, выберите тест и укажите дату');
    return;
  }
  
  const selectedTest = allTests.find(t => t.id === testId);
  if (!selectedTest) {
    alert('Ошибка: тест не найден');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Сохранение...';
  submitBtn.disabled = true;
  
  try {
    const formattedDate = dateString;
    
    console.log('Сохранение дедлайна:', {
      groupId,
      groupName,
      testId: selectedTest.id,
      testTitle: selectedTest.name,
      deadline: formattedDate
    });
    
    // Проверяем существующий дедлайн для этой группы и теста
    const existingDeadline = await db.collection("deadlines")
      .where("testId", "==", testId)
      .where("groupId", "==", groupId)
      .get();
    
    if (!existingDeadline.empty) {
      // Обновляем существующий дедлайн
      const docId = existingDeadline.docs[0].id;
      await db.collection("deadlines").doc(docId).update({
        deadline: formattedDate,
        testTitle: selectedTest.name,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert(`Срок сдачи обновлен для группы ${groupName}`);
    } else {
      // Создаем новый дедлайн
      await db.collection("deadlines").add({
        groupId: groupId,
        groupName: groupName,
        testId: selectedTest.id,
        testTitle: selectedTest.name,
        deadline: formattedDate,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert(`Срок сдачи установлен для группы ${groupName}`);
    }
    
    // Перезагружаем данные
    await loadPerformanceData();
    e.target.reset();
    
  } catch (error) {
    console.error('Ошибка при сохранении дедлайна:', error);
    alert('Ошибка при сохранении срока сдачи: ' + error.message);
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  
  const studentSelect = document.getElementById('studentSelect');
  const groupSelect = document.getElementById('groupSelect');
  
  if (!studentSelect || !groupSelect) return;
  
  const studentId = studentSelect.value;
  const newGroupId = groupSelect.value;
  
  if (!studentId || !newGroupId) {
    alert('Пожалуйста, выберите студента и группу');
    return;
  }
  
  const studentName = studentSelect.options[studentSelect.selectedIndex]?.text || 'студент';
  const groupName = groupSelect.options[groupSelect.selectedIndex]?.text || 'группу';
  
  if (!confirm(`Перевести ${studentName} в группу ${groupName}?`)) {
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Перевод...';
  submitBtn.disabled = true;
  
  try {
    await transferStudent(studentId, newGroupId);
    alert(`Студент успешно переведен в группу ${groupName}`);
    await loadPerformanceData();
    e.target.reset();
  } catch (error) {
    console.error('Ошибка при переводе студента:', error);
    alert('Ошибка при переводе студента: ' + error.message);
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

async function transferStudent(studentId, newGroupId) {
  const studentDoc = await db.collection("users").doc(studentId).get();
  if (!studentDoc.exists) {
    throw new Error("Студент не найден");
  }
  
  const studentData = studentDoc.data();
  const studentName = studentData.name || '';
  const studentSurname = studentData.surname || '';
  const fullName = `${studentName} ${studentSurname}`.trim() || studentData.email || 'Студент';
  
  const newGroupDoc = await db.collection("groups").doc(newGroupId).get();
  if (!newGroupDoc.exists) {
    throw new Error("Группа не найдена");
  }
  const newGroupName = newGroupDoc.data().name;
  
  const existingUserGroup = await db.collection("usersgroup")
    .where("userId", "==", studentId)
    .get();
  
  if (!existingUserGroup.empty) {
    const docId = existingUserGroup.docs[0].id;
    await db.collection("usersgroup").doc(docId).update({
      groupId: newGroupId,
      groupName: newGroupName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Студент ${fullName} переведен в группу ${newGroupName}`);
  } else {
    await db.collection("usersgroup").add({
      userId: studentId,
      userName: fullName,
      groupId: newGroupId,
      groupName: newGroupName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Студент ${fullName} добавлен в группу ${newGroupName}`);
  }
  
  return true;
}

// ========== ИНИЦИАЛИЗАЦИЯ СТРАНИЦ ==========

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM загружен');
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1);
  
  console.log('Текущий файл:', filename);
  
  // Проверяем авторизацию для всех страниц, кроме login и register
  if (filename !== 'login.html' && filename !== 'register.html') {
    if (!checkAuth()) return;
  }
  
  // Отображаем имя преподавателя, если есть соответствующий элемент
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl && localStorage.getItem('teacherName')) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    teacherNameEl.textContent = `${name} ${surname}`.trim();
  }
  
  switch(filename) {
    case 'login.html':
      initLoginPage();
      break;
    case 'register.html':
      initRegisterPage();
      break;
    case 'courses.html':
      initCoursesPage();
      break;
    case 'groups.html':
      initGroupsPage();
      break;
    case 'group-courses.html':
      initGroupCoursesPage();
      break;
    case 'course-performance.html':
      initCoursePerformancePage();
      break;
    default:
      console.log('Страница не требует специальной инициализации:', filename);
  }
});