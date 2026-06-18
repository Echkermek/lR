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

// Проверка прав администратора
async function checkAdminAccess() {
  const teacherId = localStorage.getItem('teacherId');
  console.log('teacherId:', teacherId); // Отладка
  
  if (!teacherId) {
    console.log('Нет teacherId, перенаправление на login');
    window.location.href = './login.html';
    return false;
  }

  try {
    const docRef = db.collection("teacher").doc(teacherId);
    const doc = await docRef.get();
    
    console.log('Документ существует?', doc.exists); // Отладка
    
    if (!doc.exists) {
      console.log('Документ не найден, перенаправление на login');
      window.location.href = './login.html';
      return false;
    }

    const teacherData = doc.data();
    console.log('Данные преподавателя:', teacherData); // Отладка
    
    // Проверяем наличие поля admin
    const isAdmin = teacherData.admin === true;
    console.log('isAdmin:', isAdmin); // Отладка
    console.log('Тип admin:', typeof teacherData.admin); // Отладка
    
    if (!isAdmin) {
      console.log('Не админ, перенаправление на courses');
      window.location.href = './courses.html';
      return false;
    }

    // Сохраняем данные преподавателя
    localStorage.setItem('teacherName', teacherData.name || '');
    localStorage.setItem('teacherSurname', teacherData.surname || '');
    localStorage.setItem('teacherEmail', teacherData.login || '');
    
    console.log('Доступ разрешен! Показываем админ-панель');
    return true;
    
  } catch (error) {
    console.error('Ошибка проверки прав:', error);
    window.location.href = './login.html';
    return false;
  }
}

function logout() {
  localStorage.removeItem('teacherId');
  localStorage.removeItem('teacherName');
  localStorage.removeItem('teacherSurname');
  localStorage.removeItem('teacherEmail');
  window.location.href = './login.html';
}

// Отображение имени преподавателя
function displayTeacherName() {
  const nameElement = document.getElementById('teacherName');
  if (nameElement) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    nameElement.textContent = `${name} ${surname}`.trim();
  }
}

function loadTeachers() {
  db.collection("teacher").orderBy("createdAt", "desc").onSnapshot(snap => {
    const tbody = document.getElementById("teachersList");
    tbody.innerHTML = "";
    
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Нет преподавателей</td></tr>`;
      return;
    }
    
    snap.forEach(doc => {
      const teacher = doc.data();
      const tr = document.createElement("tr");
      
      const lastLogin = teacher.last_login_time ? 
        new Date(teacher.last_login_time.toDate()).toLocaleString('ru-RU') : 
        'Никогда';
        
      // Добавляем индикатор администратора
      const adminBadge = teacher.admin === true ? 
        '<span class="badge badge-success">Админ</span>' : 
        '<span class="badge badge-secondary">Преподаватель</span>';
        
      tr.innerHTML = `
        <td>${teacher.name || ''}</td>
        <td>${teacher.surname || ''}</td>
        <td>${teacher.login || ''}</td>
        <td>${lastLogin}</td>
        <td>${adminBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function generateInviteCode() {
  const code = generateRandomCode(8);
  const messageDiv = document.getElementById('codeMessage');
  
  db.collection("invite_codes").add({
    code: code,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    used: false,
    createdBy: localStorage.getItem('teacherId')
  }).then(() => {
    messageDiv.innerHTML = `<div class="alert alert-success">Код приглашения: <strong>${code}</strong></div>`;
  }).catch(error => {
    messageDiv.innerHTML = `<div class="alert alert-danger">Ошибка генерации кода: ${error.message}</div>`;
  });
}

function generateRandomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function init() {
  console.log('Инициализация админ-панели...');
  
  const hasAccess = await checkAdminAccess();
  console.log('hasAccess:', hasAccess);
  
  if (!hasAccess) {
    console.log('Нет доступа, показываем сообщение об ошибке');
    // Показываем сообщение о запрете доступа
    document.getElementById('accessDenied').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
    return;
  }
  
  // Если есть доступ, показываем контент
  console.log('Доступ есть, показываем админ-панель');
  document.getElementById('adminContent').style.display = 'block';
  document.getElementById('accessDenied').style.display = 'none';
  
  // Отображаем имя
  displayTeacherName();
  
  // Загружаем список преподавателей
  loadTeachers();
}

init();