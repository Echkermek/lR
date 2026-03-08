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

// Проверка авторизации
if (!localStorage.getItem('teacherId')) {
  window.location.href = 'login.html';
}

// Отображение имени преподавателя
document.addEventListener('DOMContentLoaded', function() {
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl) {
    const name = localStorage.getItem('teacherName') || '';
    const surname = localStorage.getItem('teacherSurname') || '';
    teacherNameEl.textContent = `${name} ${surname}`.trim();
  }
});

function logout() { 
  localStorage.removeItem('teacherId'); 
  localStorage.removeItem('teacherName');
  localStorage.removeItem('teacherSurname');
  localStorage.removeItem('teacherEmail');
  window.location.href = 'login.html'; 
}

let currentTestId = null;
let currentPartId = null;
let currentQuestionId = null;
let lectures = [];

// Загрузка лекций для выпадающего списка
db.collection("lections").orderBy("num").onSnapshot(snap => {
  console.log('Загружено лекций:', snap.size);
  lectures = [];
  snap.forEach(doc => {
    lectures.push({ id: doc.id, ...doc.data() });
  });
  updateLectureSelects();
}, error => {
  console.error("Ошибка загрузки лекций:", error);
});

function updateLectureSelects() {
  const select = document.getElementById("editPartLecture");
  if (select) {
    select.innerHTML = '<option value="">Без привязки к лекции</option>';
    lectures.forEach(lecture => {
      select.innerHTML += `<option value="${lecture.id}">Лекция ${lecture.num} - ${lecture.name}</option>`;
    });
  }
}

// Загрузка тестов
db.collection("tests").orderBy("num").onSnapshot(snap => {
  console.log('Загружено тестов:', snap.size);
  const container = document.getElementById("testsList");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (snap.empty) {
    container.innerHTML = "<p class='text-muted text-center py-4'>Тестов пока нет</p>";
    return;
  }
  
  snap.forEach(doc => {
    const test = { id: doc.id, ...doc.data() };
    const div = document.createElement("div");
    div.className = "test-item";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-1">${test.title || "Без названия"}</h5>
          <p class="mb-0 text-muted">Номер: ${test.num || "Не указан"}</p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm mr-2" onclick="openEditTest('${test.id}')">Редактировать</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTest('${test.id}')">Удалить</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}, error => {
  console.error("Ошибка загрузки тестов:", error);
  const container = document.getElementById("testsList");
  if (container) {
    container.innerHTML = `<p class="text-danger text-center">Ошибка загрузки: ${error.message}</p>`;
  }
});

// Загрузка лекций для списка
db.collection("lections").orderBy("num").onSnapshot(snap => {
  console.log('Загружено лекций для списка:', snap.size);
  const container = document.getElementById("lecturesList");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (snap.empty) {
    container.innerHTML = "<p class='text-muted text-center py-4'>Лекций пока нет</p>";
    return;
  }
  
  snap.forEach(doc => {
    const lecture = { id: doc.id, ...doc.data() };
    const div = document.createElement("div");
    div.className = "lecture-item";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-1">${lecture.name || "Без названия"}</h5>
          <p class="mb-0 text-muted">Номер: ${lecture.num || "Не указан"}</p>
          ${lecture.url ? `<a href="${lecture.url}" target="_blank" class="text-success small">Открыть лекцию →</a>` : ""}
        </div>
        <div>
          <button class="btn btn-primary btn-sm mr-2" onclick="openEditLecture('${lecture.id}')">Редактировать</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLecture('${lecture.id}')">Удалить</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}, error => {
  console.error("Ошибка загрузки лекций:", error);
  const container = document.getElementById("lecturesList");
  if (container) {
    container.innerHTML = `<p class="text-danger text-center">Ошибка загрузки: ${error.message}</p>`;
  }
});

// Функции для работы с тестами
function addTest() {
  const title = document.getElementById("newTestTitle").value.trim();
  const num = document.getElementById("newTestNum").value;
  const messageDiv = document.getElementById('addTestMessage');
  
  if (!title || !num) {
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-warning">Заполните все поля</div>';
    return;
  }
  
  const btn = document.getElementById('addTestBtnText');
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Добавление...';
  
  db.collection("tests").add({
    title,
    num: parseInt(num),
    isAvailable: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById("newTestTitle").value = "";
    document.getElementById("newTestNum").value = "";
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-success">Тест успешно создан</div>';
    setTimeout(() => {
      if (messageDiv) messageDiv.innerHTML = '';
    }, 3000);
  }).catch(error => {
    console.error("Ошибка создания теста:", error);
    if (messageDiv) messageDiv.innerHTML = `<div class="alert alert-danger">Ошибка: ${error.message}</div>`;
  }).finally(() => {
    btn.textContent = originalText;
  });
}

function openEditTest(testId) {
  currentTestId = testId;
  
  db.collection("tests").doc(testId).get().then(doc => {
    if (doc.exists) {
      const test = doc.data();
      document.getElementById("modalTestTitle").textContent = test.title;
      document.getElementById("editTestTitle").value = test.title;
      document.getElementById("editTestNum").value = test.num;
      
      loadTestParts(testId);
      
      $('#editTestModal').modal('show');
    }
  }).catch(error => {
    console.error("Ошибка загрузки теста:", error);
    alert("Ошибка загрузки теста: " + error.message);
  });
}

function loadTestParts(testId) {
  const container = document.getElementById("testPartsList");
  container.innerHTML = "<p class='text-muted'>Загрузка частей...</p>";
  
  db.collection("tests").doc(testId).collection("parts").orderBy("num").get()
    .then(snap => {
      container.innerHTML = "";
      
      if (snap.empty) {
        container.innerHTML = "<p class='text-muted'>Частей пока нет</p>";
        return;
      }
      
      snap.forEach(doc => {
        const part = { id: doc.id, ...doc.data() };
        const lectureName = part.lecId ? getLectureName(part.lecId) : "Не привязана";
        
        const partDiv = document.createElement("div");
        partDiv.className = "part-item d-flex justify-content-between align-items-center";
        partDiv.innerHTML = `
          <div>
            <strong>${part.title || "Без названия"}</strong>
            <small class="text-muted ml-2">(Часть ${part.num})</small>
            <br>
            <small class="text-info">Лекция: ${lectureName}</small>
          </div>
          <div>
            <button class="btn btn-primary btn-sm mr-2" onclick="openEditPart('${testId}', '${part.id}')">Ред.</button>
            <button class="btn btn-danger btn-sm" onclick="deletePart('${testId}', '${part.id}')">Удалить</button>
          </div>
        `;
        container.appendChild(partDiv);
      });
    })
    .catch(error => {
      console.error("Ошибка загрузки частей:", error);
      container.innerHTML = "<p class='text-danger'>Ошибка загрузки частей</p>";
    });
}

function getLectureName(lecId) {
  const lecture = lectures.find(l => l.id === lecId);
  return lecture ? `Лекция ${lecture.num} - ${lecture.name}` : "Не найдена";
}

function addPartToTest() {
  if (!currentTestId) return;
  
  const title = prompt("Введите название части:");
  const num = prompt("Введите номер части:");
  
  if (title && num) {
    db.collection("tests").doc(currentTestId).collection("parts").add({
      testId: currentTestId,
      title,
      num: parseInt(num),
      lecId: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      loadTestParts(currentTestId);
    }).catch(error => {
      alert("Ошибка добавления части: " + error.message);
    });
  }
}

function saveTestChanges() {
  if (!currentTestId) return;
  
  const title = document.getElementById("editTestTitle").value.trim();
  const num = document.getElementById("editTestNum").value;
  
  if (!title || !num) {
    alert("Заполните все поля");
    return;
  }
  
  const saveBtn = document.querySelector('#editTestModal .btn-primary');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Сохранение...';
  saveBtn.disabled = true;
  
  db.collection("tests").doc(currentTestId).update({
    title,
    num: parseInt(num)
  }).then(() => {
    $('#editTestModal').modal('hide');
  }).catch(error => {
    alert("Ошибка сохранения: " + error.message);
  }).finally(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

function deleteTest(testId) {
  if (confirm("Вы уверены, что хотите удалить этот тест?")) {
    db.collection("tests").doc(testId).delete()
      .then(() => {
        console.log("Тест удален");
      })
      .catch(error => {
        alert("Ошибка удаления теста: " + error.message);
      });
  }
}

// Функции для работы с лекциями
function addLecture() {
  const name = document.getElementById("newLectureName").value.trim();
  const num = document.getElementById("newLectureNum").value.trim();
  const url = document.getElementById("newLectureUrl").value.trim();
  const messageDiv = document.getElementById('addLectureMessage');
  
  if (!name || !num || !url) {
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-warning">Заполните все поля</div>';
    return;
  }
  
  // Простая валидация URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-warning">URL должен начинаться с http:// или https://</div>';
    return;
  }
  
  const btn = document.getElementById('addLectureBtnText');
  const originalText = btn.textContent;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Добавление...';
  
  db.collection("lections").add({
    name,
    num: num,
    url,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById("newLectureName").value = "";
    document.getElementById("newLectureNum").value = "";
    document.getElementById("newLectureUrl").value = "";
    if (messageDiv) messageDiv.innerHTML = '<div class="alert alert-success">Лекция успешно добавлена</div>';
    setTimeout(() => {
      if (messageDiv) messageDiv.innerHTML = '';
    }, 3000);
  }).catch(error => {
    console.error("Ошибка создания лекции:", error);
    if (messageDiv) messageDiv.innerHTML = `<div class="alert alert-danger">Ошибка: ${error.message}</div>`;
  }).finally(() => {
    btn.textContent = originalText;
  });
}

function openEditLecture(lectureId) {
  db.collection("lections").doc(lectureId).get().then(doc => {
    if (doc.exists) {
      const lecture = doc.data();
      const newName = prompt("Новое название лекции:", lecture.name);
      if (newName === null) return;
      
      const newNum = prompt("Новый номер лекции:", lecture.num);
      if (newNum === null) return;
      
      const newUrl = prompt("Новая ссылка на лекцию:", lecture.url);
      if (newUrl === null) return;
      
      db.collection("lections").doc(lectureId).update({
        name: newName,
        num: newNum,
        url: newUrl
      }).catch(error => {
        alert("Ошибка обновления лекции: " + error.message);
      });
    }
  });
}

function deleteLecture(lectureId) {
  if (confirm("Вы уверены, что хотите удалить эту лекцию?")) {
    db.collection("lections").doc(lectureId).delete()
      .then(() => {
        console.log("Лекция удалена");
      })
      .catch(error => {
        alert("Ошибка удаления лекции: " + error.message);
      });
  }
}

// Функции для работы с частями теста
function openEditPart(testId, partId) {
  currentTestId = testId;
  currentPartId = partId;
  
  db.collection("tests").doc(testId).collection("parts").doc(partId).get().then(doc => {
    if (doc.exists) {
      const part = doc.data();
      document.getElementById("editPartTitle").value = part.title;
      document.getElementById("editPartNum").value = part.num;
      
      const lectureSelect = document.getElementById("editPartLecture");
      if (lectureSelect) {
        lectureSelect.value = part.lecId || "";
      }
      
      loadPartQuestions(testId, partId);
      
      $('#editPartModal').modal('show');
    }
  }).catch(error => {
    console.error("Ошибка загрузки части:", error);
    alert("Ошибка загрузки части: " + error.message);
  });
}

function loadPartQuestions(testId, partId) {
  const container = document.getElementById("partQuestionsList");
  container.innerHTML = "<p class='text-muted'>Загрузка вопросов...</p>";
  
  db.collection("tests").doc(testId).collection("parts").doc(partId).collection("questions").orderBy("num").get()
    .then(snap => {
      container.innerHTML = "";
      
      if (snap.empty) {
        container.innerHTML = "<p class='text-muted'>Вопросов пока нет</p>";
        return;
      }
      
      snap.forEach(doc => {
        const question = { id: doc.id, ...doc.data() };
        const answersCount = question.answers ? question.answers.length : 0;
        const correctAnswers = question.answers ? question.answers.filter(a => a.isCorrect).length : 0;
        
        const questionDiv = document.createElement("div");
        questionDiv.className = "question-item d-flex justify-content-between align-items-center";
        questionDiv.innerHTML = `
          <div>
            <strong>Вопрос ${question.num}:</strong> ${question.text || "Без текста"}
            <div class="mt-1">
              <small class="text-muted">
                Ответов: ${answersCount} | Правильных: ${correctAnswers}
              </small>
            </div>
          </div>
          <div>
            <button class="btn btn-primary btn-sm mr-2" onclick="openEditQuestion('${testId}', '${partId}', '${question.id}')">Ред.</button>
            <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${testId}', '${partId}', '${question.id}')">Удалить</button>
          </div>
        `;
        container.appendChild(questionDiv);
      });
    })
    .catch(error => {
      console.error("Ошибка загрузки вопросов:", error);
      container.innerHTML = "<p class='text-danger'>Ошибка загрузки вопросов</p>";
    });
}

function addQuestionToPart() {
  if (!currentTestId || !currentPartId) return;
  
  const text = prompt("Введите текст вопроса:");
  if (!text) return;
  
  const num = prompt("Введите номер вопроса:");
  if (!num) return;
  
  db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").add({
    partId: currentPartId,
    text,
    num: parseInt(num),
    answers: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    loadPartQuestions(currentTestId, currentPartId);
  }).catch(error => {
    alert("Ошибка добавления вопроса: " + error.message);
  });
}

function savePartChanges() {
  if (!currentTestId || !currentPartId) return;
  
  const title = document.getElementById("editPartTitle").value.trim();
  const num = document.getElementById("editPartNum").value;
  const lectureId = document.getElementById("editPartLecture").value || null;
  
  if (!title || !num) {
    alert("Заполните все обязательные поля");
    return;
  }
  
  const saveBtn = document.querySelector('#editPartModal .btn-primary');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Сохранение...';
  saveBtn.disabled = true;
  
  db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).update({
    title,
    num: parseInt(num),
    lecId: lectureId
  }).then(() => {
    $('#editPartModal').modal('hide');
    loadTestParts(currentTestId);
  }).catch(error => {
    alert("Ошибка сохранения: " + error.message);
  }).finally(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

function deletePart(testId, partId) {
  if (confirm("Вы уверены, что хотите удалить эту часть?")) {
    db.collection("tests").doc(testId).collection("parts").doc(partId).delete()
    .then(() => {
      loadTestParts(testId);
    })
    .catch(error => {
      alert("Ошибка удаления части: " + error.message);
    });
  }
}

// Функции для работы с вопросами и ответами
function openEditQuestion(testId, partId, questionId) {
  currentTestId = testId;
  currentPartId = partId;
  currentQuestionId = questionId;
  
  db.collection("tests").doc(testId).collection("parts").doc(partId).collection("questions").doc(questionId).get().then(doc => {
    if (doc.exists) {
      const question = doc.data();
      document.getElementById("editQuestionText").value = question.text;
      document.getElementById("editQuestionNum").value = question.num;
      
      loadQuestionAnswers(questionId, question.answers);
      
      $('#editQuestionModal').modal('show');
    }
  }).catch(error => {
    console.error("Ошибка загрузки вопроса:", error);
    alert("Ошибка загрузки вопроса: " + error.message);
  });
}

function loadQuestionAnswers(questionId, answersArray) {
  const container = document.getElementById("questionAnswersList");
  container.innerHTML = "";
  
  if (!answersArray || answersArray.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info">
        <p class="mb-2">Ответов пока нет</p>
        <button class="btn btn-success btn-sm" onclick="addNewAnswer()">+ Добавить ответ</button>
      </div>
    `;
    return;
  }
  
  answersArray.forEach((answer, index) => {
    const answerDiv = document.createElement("div");
    answerDiv.className = "answer-item";
    answerDiv.innerHTML = `
      <div class="flex-grow-1 mr-2">
        <input type="text" class="form-control" value="${answer.text || ''}" 
               onchange="updateAnswerText(${index}, this.value)"
               placeholder="Текст ответа">
      </div>
      <div class="form-check mr-2">
        <input class="form-check-input" type="radio" name="correctAnswer" 
               ${answer.isCorrect ? "checked" : ""} 
               onchange="setCorrectAnswer(${index})">
        <label class="form-check-label">Правильный</label>
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteAnswer(${index})">×</button>
    `;
    container.appendChild(answerDiv);
  });
  
  const addButtonDiv = document.createElement("div");
  addButtonDiv.className = "text-center mt-3";
  addButtonDiv.innerHTML = `
    <button class="btn btn-success btn-sm" onclick="addNewAnswer()">
      + Добавить вариант ответа
    </button>
  `;
  container.appendChild(addButtonDiv);
}

function addNewAnswer() {
  if (!currentQuestionId) {
    alert("Сначала выберите вопрос");
    return;
  }
  
  const text = prompt("Введите текст ответа:");
  
  if (text && text.trim()) {
    db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).get().then(doc => {
      if (doc.exists) {
        const question = doc.data();
        const currentAnswers = question.answers || [];
        
        currentAnswers.push({
          text: text.trim(),
          isCorrect: false
        });
        
        return db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).update({
          answers: currentAnswers
        });
      }
    }).then(() => {
      openEditQuestion(currentTestId, currentPartId, currentQuestionId);
    }).catch(error => {
      alert("Ошибка добавления ответа: " + error.message);
    });
  }
}

function updateAnswerText(answerIndex, newText) {
  if (!newText.trim()) {
    alert("Текст ответа не может быть пустым");
    return;
  }
  
  db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).get().then(doc => {
    if (doc.exists) {
      const question = doc.data();
      const currentAnswers = question.answers || [];
      
      if (currentAnswers[answerIndex]) {
        currentAnswers[answerIndex].text = newText.trim();
        
        return db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).update({
          answers: currentAnswers
        });
      }
    }
  }).catch(error => {
    alert("Ошибка обновления ответа: " + error.message);
  });
}

function setCorrectAnswer(answerIndex) {
  db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).get().then(doc => {
    if (doc.exists) {
      const question = doc.data();
      const currentAnswers = question.answers || [];
      
      currentAnswers.forEach((answer, index) => {
        answer.isCorrect = (index === answerIndex);
      });
      
      return db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).update({
        answers: currentAnswers
      });
    }
  }).then(() => {
    openEditQuestion(currentTestId, currentPartId, currentQuestionId);
  }).catch(error => {
    alert("Ошибка установки правильного ответа: " + error.message);
  });
}

function deleteAnswer(answerIndex) {
  if (confirm("Удалить этот вариант ответа?")) {
    db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).get().then(doc => {
      if (doc.exists) {
        const question = doc.data();
        const currentAnswers = question.answers || [];
        
        currentAnswers.splice(answerIndex, 1);
        
        return db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).update({
          answers: currentAnswers
        });
      }
    }).then(() => {
      openEditQuestion(currentTestId, currentPartId, currentQuestionId);
    }).catch(error => {
      alert("Ошибка удаления ответа: " + error.message);
    });
  }
}

function saveQuestionChanges() {
  if (!currentTestId || !currentPartId || !currentQuestionId) return;
  
  const text = document.getElementById("editQuestionText").value.trim();
  const num = document.getElementById("editQuestionNum").value;
  
  if (!text) {
    alert("Введите текст вопроса");
    return;
  }
  
  if (!num) {
    alert("Введите номер вопроса");
    return;
  }

  const saveBtn = document.querySelector('#editQuestionModal .btn-primary');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Сохранение...';
  saveBtn.disabled = true;
  
  db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).get().then(doc => {
    if (doc.exists) {
      const question = doc.data();
      const currentAnswers = question.answers || [];
      
      return db.collection("tests").doc(currentTestId).collection("parts").doc(currentPartId).collection("questions").doc(currentQuestionId).update({
        text: text,
        num: parseInt(num),
        answers: currentAnswers
      });
    }
  }).then(() => {
    $('#editQuestionModal').modal('hide');
    loadPartQuestions(currentTestId, currentPartId);
  }).catch(error => {
    alert("Ошибка сохранения: " + error.message);
  }).finally(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

function deleteQuestion(testId, partId, questionId) {
  if (confirm("Вы уверены, что хотите удалить этот вопрос?")) {
    db.collection("tests").doc(testId).collection("parts").doc(partId).collection("questions").doc(questionId).delete()
    .then(() => {
      loadPartQuestions(testId, partId);
    })
    .catch(error => {
      alert("Ошибка удаления вопроса: " + error.message);
    });
  }
}