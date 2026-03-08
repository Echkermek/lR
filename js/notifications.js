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

const currentTeacherId = localStorage.getItem('teacherId');
let groups = [];
let groupIds = [];
let students = [];
let studentIds = [];

function logout() {
  localStorage.removeItem('teacherId');
  window.location.href = './login.html';
}

document.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
  loadGroups();
  loadMessages();
});

function setupEventListeners() {
  document.getElementById('recipientType').addEventListener('change', function(e) {
    const isStudent = e.target.value === 'student';
    
    document.getElementById('studentField').classList.toggle('d-none', !isStudent);
    document.getElementById('studentSelect').required = isStudent;
    
    const buttonText = document.getElementById('sendButtonText');
    buttonText.textContent = isStudent ? 'Отправить студенту' : 'Отправить группе';
    
    if (isStudent && document.getElementById('groupSelect').value) {
      loadStudents(document.getElementById('groupSelect').value);
    }
  });

  document.getElementById('groupSelect').addEventListener('change', function(e) {
    if (document.getElementById('recipientType').value === 'student' && e.target.value) {
      loadStudents(e.target.value);
    }
  });

  document.getElementById('messageForm').addEventListener('submit', sendMessage);
}

function loadGroups() {
  db.collection("usersgroup").get()
    .then(snapshot => {
      const uniqueGroups = new Map();

      snapshot.forEach(doc => {
        const data = doc.data();
        const groupId = data.groupId;
        const groupName = data.groupName;
        
        if (groupId && groupName && !uniqueGroups.has(groupId)) {
          uniqueGroups.set(groupId, groupName);
        }
      });

      groups = Array.from(uniqueGroups.values());
      groupIds = Array.from(uniqueGroups.keys());

      const groupSelect = document.getElementById('groupSelect');
      groupSelect.innerHTML = '<option value="">Выберите группу</option>';
      
      groups.forEach((group, index) => {
        const option = document.createElement('option');
        option.value = groupIds[index];
        option.textContent = group;
        groupSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error("Ошибка загрузки групп:", error);
      document.getElementById('groupSelect').innerHTML = '<option value="">Ошибка загрузки</option>';
    });
}

function loadStudents(groupId) {
  const studentSelect = document.getElementById('studentSelect');
  studentSelect.innerHTML = '<option value="">Загрузка студентов...</option>';

  db.collection("usersgroup")
    .where("groupId", "==", groupId)
    .get()
    .then(snapshot => {
      students = [];
      studentIds = [];
      studentSelect.innerHTML = '<option value="">Выберите студента</option>';

      snapshot.forEach(doc => {
        const data = doc.data();
        const userId = data.userId;
        const userName = data.userName;
        
        if (userId && userName) {
          students.push(userName);
          studentIds.push(userId);
          
          const option = document.createElement('option');
          option.value = userId;
          option.textContent = userName;
          studentSelect.appendChild(option);
        }
      });

      if (students.length === 0) {
        studentSelect.innerHTML = '<option value="">В группе нет студентов</option>';
      }
    })
    .catch(error => {
      console.error("Ошибка загрузки студентов:", error);
      studentSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
    });
}

async function sendMessage(e) {
  e.preventDefault();
  
  const recipientType = document.getElementById('recipientType').value;
  const messageText = document.getElementById('messageText').value.trim();
  
  let recipientId, recipientName;

  if (recipientType === 'group') {
    const groupIndex = document.getElementById('groupSelect').selectedIndex - 1;
    if (groupIndex < 0) {
      alert('Выберите группу');
      return;
    }
    recipientId = groupIds[groupIndex];
    recipientName = groups[groupIndex];
  } else {
    const studentIndex = document.getElementById('studentSelect').selectedIndex - 1;
    if (studentIndex < 0) {
      alert('Выберите студента');
      return;
    }
    recipientId = studentIds[studentIndex];
    recipientName = students[studentIndex];
  }

  if (!messageText) {
    alert('Введите текст сообщения');
    return;
  }

  const sendButton = document.querySelector('#messageForm button[type="submit"]');
  const buttonText = document.getElementById('sendButtonText');
  const buttonSpinner = document.getElementById('sendButtonSpinner');
  
  buttonText.textContent = 'Отправка...';
  buttonSpinner.classList.remove('d-none');
  sendButton.disabled = true;

  try {
    const messageData = {
      text: messageText,
      recipientId: recipientId,
      recipientName: recipientName,
      senderId: currentTeacherId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      recipientType: recipientType
    };

    const docRef = await db.collection("teacher_messages").add(messageData);
    
    document.getElementById('messageText').value = '';
    
    buttonText.textContent = recipientType === 'group' ? 'Отправлено группе!' : 'Отправлено студенту!';
    setTimeout(() => {
      buttonText.textContent = recipientType === 'group' ? 'Отправить группе' : 'Отправить студенту';
      buttonSpinner.classList.add('d-none');
      sendButton.disabled = false;
    }, 2000);

    await sendPushNotification(recipientId, messageText, docRef.id, recipientName, recipientType);
    
  } catch (error) {
    console.error("Ошибка отправки:", error);
    alert('Ошибка отправки: ' + error.message);
    
    buttonText.textContent = recipientType === 'group' ? 'Отправить группе' : 'Отправить студенту';
    buttonSpinner.classList.add('d-none');
    sendButton.disabled = false;
  }
}

async function sendPushNotification(recipientId, messageText, messageId, recipientName, recipientType) {
  try {
    const tokenDoc = await db.collection("fcm_tokens").doc(recipientId).get();
    
    if (!tokenDoc.exists) {
      console.warn("FCM токен не найден для:", recipientId);
      return;
    }

    const token = tokenDoc.data().token;
    if (!token) {
      console.warn("FCM токен пустой для:", recipientId);
      return;
    }

    await sendFCMNotification(token, messageText, messageId, recipientId, recipientName, recipientType);
    
  } catch (error) {
    console.error("Ошибка отправки push-уведомления:", error);
  }
}

async function sendFCMNotification(token, message, messageId, recipientId, recipientName, recipientType) {
  console.log("Отправка FCM уведомления:", {
    to: recipientType === 'group' ? 'группе' : 'студенту',
    recipient: recipientName,
    token: token.substring(0, 20) + "...",
    message: message,
    messageId: messageId
  });
}

function loadMessages() {
  if (!currentTeacherId) return;

  db.collection("teacher_messages")
    .where("senderId", "==", currentTeacherId)
    .orderBy("timestamp", "desc")
    .onSnapshot(snapshot => {
      const messagesList = document.getElementById('messagesList');
      const totalCount = document.getElementById('totalCount');
      const groupCount = document.getElementById('groupCount');
      const studentCount = document.getElementById('studentCount');
      
      if (snapshot.empty) {
        messagesList.innerHTML = '<div class="text-center text-muted">Нет отправленных сообщений</div>';
        totalCount.textContent = '0';
        groupCount.textContent = '0 групп';
        studentCount.textContent = '0 студентов';
        return;
      }

      let groupMessages = 0;
      let studentMessages = 0;
      let html = '';

      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
        const isGroup = data.recipientType === 'group';
        
        if (isGroup) {
          groupMessages++;
        } else {
          studentMessages++;
        }

        html += `
          <div class="message-item p-3 mb-3 bg-white ${isGroup ? 'group' : 'student'}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <span class="badge recipient-badge ${isGroup ? 'bg-info' : 'bg-success'}">
                  ${isGroup ? 'Группа' : 'Студент'}
                </span>
                <strong class="ml-2">${data.recipientName}</strong>
              </div>
              <small class="text-muted">${formatDate(timestamp)}</small>
            </div>
            <p class="mb-0">${data.text}</p>
          </div>
        `;
      });

      messagesList.innerHTML = html;
      totalCount.textContent = snapshot.size.toString();
      groupCount.textContent = `${groupMessages} групп`;
      studentCount.textContent = `${studentMessages} студентов`;
    }, error => {
      console.error("Ошибка загрузки сообщений:", error);
      document.getElementById('messagesList').innerHTML = 
        '<div class="text-center text-danger">Ошибка загрузки сообщений</div>';
    });
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}