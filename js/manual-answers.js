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

let currentAnswer = null;
let currentAttemptId = null;
let groups = [];
let groupIds = [];

document.addEventListener('DOMContentLoaded', function() {
  loadGroups();
});

function loadGroups() {
  db.collection("groups").orderBy("name").get()
    .then(snapshot => {
      const groupFilter = document.getElementById('groupFilter');
      groupFilter.innerHTML = '<option value="">Все группы</option>';
      
      snapshot.forEach(doc => {
        const groupData = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = groupData.name;
        groupFilter.appendChild(option);
      });

      loadManualAnswers();
    })
    .catch(error => {
      console.error("Ошибка загрузки групп:", error);
    });
}

function loadManualAnswers() {
  const groupId = document.getElementById('groupFilter').value;
  
  document.getElementById('pendingAnswersList').innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="sr-only">Загрузка...</span>
      </div>
      <p class="mt-2">Загрузка работ...</p>
    </div>
  `;
  document.getElementById('checkedAnswersList').innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="sr-only">Загрузка...</span>
      </div>
      <p class="mt-2">Загрузка работ...</p>
    </div>
  `;

  let query = db.collection("test_attempts")
    .where("isManual", "==", true);

  if (groupId) {
    db.collection("usersgroup")
      .where("groupId", "==", groupId)
      .get()
      .then(studentSnapshot => {
        const studentIds = studentSnapshot.docs.map(doc => doc.data().userId);
        if (studentIds.length > 0) {
          query = query.where("userId", "in", studentIds);
          executeQuery(query);
        } else {
          showEmptyLists();
        }
      })
      .catch(error => {
        console.error("Ошибка загрузки студентов:", error);
        executeQuery(query);
      });
  } else {
    executeQuery(query);
  }
}

function executeQuery(query) {
  query.get()
    .then(async snapshot => {
      const pendingAnswers = [];
      const checkedAnswers = [];

      for (const doc of snapshot.docs) {
        const attempt = { id: doc.id, ...doc.data() };
        
        const isPassed = attempt.isPassed === true;
        
        await enrichAttemptData(attempt);
        
        if (isPassed) {
          checkedAnswers.push(attempt);
        } else {
          pendingAnswers.push(attempt);
        }
      }

      document.getElementById('pendingCount').textContent = pendingAnswers.length;
      document.getElementById('checkedCount').textContent = checkedAnswers.length;

      renderAnswers(pendingAnswers, 'pendingAnswersList', false);
      renderAnswers(checkedAnswers, 'checkedAnswersList', true);
    })
    .catch(error => {
      console.error("Ошибка загрузки ответов:", error);
      showEmptyLists();
    });
}

async function enrichAttemptData(attempt) {
  try {
    const userDoc = await db.collection("users").doc(attempt.userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      attempt.userName = `${userData.name || ''} ${userData.surname || ''}`.trim() || attempt.userId;
    } else {
      attempt.userName = attempt.userId;
    }

    if (attempt.partId && attempt.testId) {
      const partDoc = await db.collection("tests")
        .doc(attempt.testId)
        .collection("parts")
        .doc(attempt.partId)
        .get();
      
      if (partDoc.exists) {
        attempt.partTitle = partDoc.data().title || 'Часть без названия';
      } else {
        attempt.partTitle = 'Часть не найдена';
      }

      const testDoc = await db.collection("tests").doc(attempt.testId).get();
      if (testDoc.exists) {
        attempt.testTitle = testDoc.data().title || 'Тест без названия';
      } else {
        attempt.testTitle = 'Тест не найден';
      }

      if (attempt.manualQuestionId) {
        const questionDoc = await db.collection("tests")
          .doc(attempt.testId)
          .collection("parts")
          .doc(attempt.partId)
          .collection("questions")
          .doc(attempt.manualQuestionId)
          .get();
        
        if (questionDoc.exists) {
          attempt.questionText = questionDoc.data().text || 'Вопрос без текста';
        } else {
          attempt.questionText = 'Вопрос не найден';
        }
      }
    }
  } catch (error) {
    console.error("Ошибка обогащения данных:", error);
  }
}

function renderAnswers(answers, containerId, isChecked) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (answers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${isChecked ? 'Нет проверенных работ' : 'Нет непроверенных работ'}</p>
      </div>
    `;
    return;
  }

  answers.sort((a, b) => {
    const dateA = a.timestamp?.toDate?.() || new Date(0);
    const dateB = b.timestamp?.toDate?.() || new Date(0);
    return dateB - dateA;
  });

  answers.forEach(answer => {
    const card = document.createElement('div');
    card.className = `answer-card ${isChecked ? 'checked' : ''}`;
    
    const date = answer.timestamp?.toDate?.() 
      ? answer.timestamp.toDate().toLocaleString('ru-RU') 
      : 'Неизвестно';

    const actionButtons = isChecked ? `
      <div class="action-buttons">
        <button class="btn btn-info btn-sm" onclick="editGrade('${answer.id}')">Редактировать оценку</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAnswer('${answer.id}')">Удалить ответ</button>
      </div>
    ` : `
      <div class="action-buttons">
        <button class="btn btn-primary btn-sm" onclick="rateAnswer('${answer.id}')">Оценить работу</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAnswer('${answer.id}')">Удалить ответ</button>
      </div>
    `;

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div style="flex: 1;">
          <div class="student-info">${answer.userName || 'Неизвестный студент'}</div>
          <div class="test-info">
            ${answer.testTitle || 'Тест'} - ${answer.partTitle || 'Часть'}
            <br>
            <small>Отправлено: ${date}</small>
          </div>
          <div class="question-text">
            <strong>Вопрос:</strong> ${answer.questionText || 'Текст вопроса не найден'}
          </div>
          <div class="answer-text">
            <strong>Ответ:</strong> ${answer.manualAnswer || 'Ответ не найден'}
          </div>
        </div>
        <div>
          ${isChecked 
            ? `<span class="badge badge-checked p-2">Оценка: ${answer.finalScore || 0}</span>` 
            : '<span class="badge badge-pending p-2">Ожидает проверки</span>'
          }
        </div>
      </div>
      ${actionButtons}
    `;

    container.appendChild(card);
  });
}

function showEmptyLists() {
  document.getElementById('pendingAnswersList').innerHTML = `
    <div class="empty-state">
      <p>Нет работ для отображения</p>
    </div>
  `;
  document.getElementById('checkedAnswersList').innerHTML = `
    <div class="empty-state">
      <p>Нет работ для отображения</p>
    </div>
  `;
  document.getElementById('pendingCount').textContent = '0';
  document.getElementById('checkedCount').textContent = '0';
}

async function rateAnswer(attemptId) {
  try {
    const attemptDoc = await db.collection("test_attempts").doc(attemptId).get();
    if (!attemptDoc.exists) {
      alert('Работа не найдена');
      return;
    }

    currentAttemptId = attemptId;
    const attempt = attemptDoc.data();

    await enrichAttemptData({ id: attemptId, ...attempt });

    document.getElementById('modalStudentName').textContent = attempt.userName || 'Неизвестный студент';
    document.getElementById('modalTestInfo').textContent = `${attempt.testTitle || 'Тест'} - ${attempt.partTitle || 'Часть'}`;
    document.getElementById('modalQuestionText').textContent = attempt.questionText || 'Текст вопроса не найден';
    document.getElementById('modalAnswerText').textContent = attempt.manualAnswer || 'Ответ не найден';
    document.getElementById('scoreInput').value = '';

    $('#rateAnswerModal').modal('show');
  } catch (error) {
    console.error("Ошибка загрузки работы:", error);
    alert('Ошибка загрузки работы');
  }
}

async function saveGrade() {
  const score = parseFloat(document.getElementById('scoreInput').value);
  
  if (isNaN(score) || score < 0 || score > 100) {
    alert('Введите корректную оценку от 0 до 100');
    return;
  }

  const saveBtn = document.getElementById('saveGradeBtn');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Сохранение...';
  saveBtn.disabled = true;

  try {
    const attemptDoc = await db.collection("test_attempts").doc(currentAttemptId).get();
    const attemptData = attemptDoc.data();

    await db.collection("test_attempts").doc(currentAttemptId).update({
      status: 'completed',
      isPassed: true,
      finalScore: score,
      rawScore: score,
      evaluatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      evaluatedBy: localStorage.getItem('teacherId')
    });

    const gradeQuery = await db.collection("test_grades")
      .where("userId", "==", attemptData.userId)
      .where("testId", "==", attemptData.testId)
      .where("partId", "==", attemptData.partId)
      .get();

    const gradeData = {
      userId: attemptData.userId,
      testId: attemptData.testId,
      partId: attemptData.partId,
      bestScore: score,
      bestAttemptId: currentAttemptId,
      isManual: true,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (gradeQuery.empty) {
      await db.collection("test_grades").add(gradeData);
    } else {
      await db.collection("test_grades").doc(gradeQuery.docs[0].id).update(gradeData);
    }

    $('#rateAnswerModal').modal('hide');
    loadManualAnswers();

  } catch (error) {
    console.error("Ошибка сохранения оценки:", error);
    alert('Ошибка сохранения оценки: ' + error.message);
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
}

async function editGrade(attemptId) {
  try {
    const attemptDoc = await db.collection("test_attempts").doc(attemptId).get();
    if (!attemptDoc.exists) {
      alert('Работа не найдена');
      return;
    }

    currentAttemptId = attemptId;
    const attempt = attemptDoc.data();

    await enrichAttemptData({ id: attemptId, ...attempt });

    document.getElementById('editStudentName').textContent = attempt.userName || 'Неизвестный студент';
    document.getElementById('editTestInfo').textContent = `${attempt.testTitle || 'Тест'} - ${attempt.partTitle || 'Часть'}`;
    document.getElementById('editQuestionText').textContent = attempt.questionText || 'Текст вопроса не найден';
    document.getElementById('editAnswerText').textContent = attempt.manualAnswer || 'Ответ не найден';
    document.getElementById('editScoreInput').value = attempt.finalScore || 0;

    $('#editGradeModal').modal('show');
  } catch (error) {
    console.error("Ошибка загрузки работы:", error);
    alert('Ошибка загрузки работы');
  }
}

async function updateGrade() {
  const score = parseFloat(document.getElementById('editScoreInput').value);
  
  if (isNaN(score) || score < 0 || score > 100) {
    alert('Введите корректную оценку от 0 до 100');
    return;
  }

  const updateBtn = document.getElementById('updateGradeBtn');
  const originalText = updateBtn.innerHTML;
  updateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Обновление...';
  updateBtn.disabled = true;

  try {
    const attemptDoc = await db.collection("test_attempts").doc(currentAttemptId).get();
    const attemptData = attemptDoc.data();

    await db.collection("test_attempts").doc(currentAttemptId).update({
      finalScore: score,
      rawScore: score,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: localStorage.getItem('teacherId')
    });

    const gradeQuery = await db.collection("test_grades")
      .where("userId", "==", attemptData.userId)
      .where("testId", "==", attemptData.testId)
      .where("partId", "==", attemptData.partId)
      .get();

    if (!gradeQuery.empty) {
      await db.collection("test_grades").doc(gradeQuery.docs[0].id).update({
        bestScore: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    $('#editGradeModal').modal('hide');
    loadManualAnswers();

  } catch (error) {
    console.error("Ошибка обновления оценки:", error);
    alert('Ошибка обновления оценки: ' + error.message);
  } finally {
    updateBtn.innerHTML = originalText;
    updateBtn.disabled = false;
  }
}

function deleteAnswer(attemptId) {
  currentAttemptId = attemptId;
  $('#deleteAnswerModal').modal('show');
}

async function confirmDeleteAnswer() {
  const deleteBtn = document.getElementById('deleteAnswerBtn');
  const originalText = deleteBtn.innerHTML;
  deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Удаление...';
  deleteBtn.disabled = true;

  try {
    const attemptDoc = await db.collection("test_attempts").doc(currentAttemptId).get();
    const attemptData = attemptDoc.data();

    if (attemptData.userId && attemptData.testId && attemptData.partId) {
      const gradeQuery = await db.collection("test_grades")
        .where("userId", "==", attemptData.userId)
        .where("testId", "==", attemptData.testId)
        .where("partId", "==", attemptData.partId)
        .get();

      if (!gradeQuery.empty) {
        const deletePromises = [];
        gradeQuery.forEach(doc => {
          deletePromises.push(db.collection("test_grades").doc(doc.id).delete());
        });
        await Promise.all(deletePromises);
      }
    }

    await db.collection("test_attempts").doc(currentAttemptId).delete();

    $('#deleteAnswerModal').modal('hide');
    loadManualAnswers();

  } catch (error) {
    console.error("Ошибка удаления ответа:", error);
    alert('Ошибка удаления ответа: ' + error.message);
  } finally {
    deleteBtn.innerHTML = originalText;
    deleteBtn.disabled = false;
  }
}