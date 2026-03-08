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
  localStorage.removeItem('teacherName');
  localStorage.removeItem('teacherSurname');
  localStorage.removeItem('teacherEmail');
  window.location.href = './login.html';
}

document.getElementById('teacherName').textContent = 
  `${localStorage.getItem('teacherName') || ''} ${localStorage.getItem('teacherSurname') || ''}`.trim();

function loadTeachers() {
  db.collection("teacher").orderBy("createdAt", "desc").onSnapshot(snap => {
    const tbody = document.getElementById("teachersList");
    tbody.innerHTML = "";
    
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Нет преподавателей</td></tr>`;
      return;
    }
    
    snap.forEach(doc => {
      const teacher = doc.data();
      const tr = document.createElement("tr");
      
      const lastLogin = teacher.last_login_time ? 
        new Date(teacher.last_login_time.toDate()).toLocaleString('ru-RU') : 
        'Никогда';
        
      tr.innerHTML = `
        <td>${teacher.name}</td>
        <td>${teacher.surname}</td>
        <td>${teacher.login}</td>
        <td>${lastLogin}</td>
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

loadTeachers();