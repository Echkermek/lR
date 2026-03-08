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

const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('test_id');
const partId = urlParams.get('part_id');

if (!testId || !partId) {
  alert("Ошибка: не передан test_id или part_id");
  history.back();
}

db.collection("tests").doc(testId).collection("parts").doc(partId).onSnapshot(doc => {
  if (doc.exists) {
    const data = doc.data();
    document.getElementById("partTitle").textContent = 
      `Раздел: ${data.title} (Часть ${data.num})`;
  } else {
    document.getElementById("partTitle").textContent = "Раздел не найден";
  }
});

const questionsRef = db.collection("tests").doc(testId).collection("parts").doc(partId).collection("questions");

questionsRef.orderBy("num").onSnapshot(snap => {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";
  
  if (snap.empty) {
    container.innerHTML = "<p class='text-muted text-center'>Вопросов пока нет</p>";
    return;
  }

  let questionNumber = 1;
  snap.forEach(qDoc => {
    const q = qDoc.data();
    const div = document.createElement("div");
    div.className = "question-item";
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <strong>Вопрос ${questionNumber}:</strong> ${q.text || "Без текста"}<br>
          ${q.content ? `<small class="text-muted">${q.content}</small><br>` : ""}
          ${q.enterAnswer ? `<span class="badge badge-custom text-white mt-1">Ответ текстом/ссылкой</span>` : ""}
        </div>
        <button class="btn btn-danger btn-sm ml-3" onclick="deleteQuestion('${qDoc.id}')">Удалить</button>
      </div>
    `;
    container.appendChild(div);
    questionNumber++;
  });
});

function addQuestion() {
  const text = document.getElementById("newQuestionText").value.trim();
  const content = document.getElementById("newQuestionContent").value.trim();
  const enterAnswer = document.getElementById("enterAnswer").checked;

  if (!text) {
    alert("Введите текст вопроса");
    return;
  }

  const addBtn = document.querySelector('#addQuestionModal .btn-primary');
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Добавление...';
  addBtn.disabled = true;

  questionsRef.add({
    text: text,
    content: content || "",
    enterAnswer: enterAnswer,
    lecId: "",
    num: Date.now(),
    testId: testId
  }).then(() => {
    $('#addQuestionModal').modal('hide');
    document.getElementById("newQuestionText").value = "";
    document.getElementById("newQuestionContent").value = "";
    document.getElementById("enterAnswer").checked = false;
  }).catch(error => {
    alert("Ошибка добавления вопроса: " + error.message);
  }).finally(() => {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
  });
}

function deleteQuestion(questionId) {
  if (confirm("Вы уверены, что хотите удалить этот вопрос?")) {
    questionsRef.doc(questionId).delete().catch(error => {
      alert("Ошибка удаления вопроса: " + error.message);
    });
  }
}