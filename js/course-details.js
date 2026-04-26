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
const courseId = urlParams.get('id');

if (!courseId) {
  alert("Нет ID курса");
  history.back();
}

let selectedLectures = new Set();
let selectedTests = new Set();
let lecturesData = [];
let testsData = [];

document.addEventListener('DOMContentLoaded', function() {
  checkCourseStatus();
  loadAssignedGroups();
  loadCourseTests();
  loadCourseLectures();
  loadAllGroups();
  loadAllLectures();
  loadAllTests();
});

function checkCourseStatus() {
  db.collection("courses").doc(courseId).onSnapshot(doc => {
    if (doc.exists) {
      const courseData = doc.data();
      const isCompleted = courseData.completed === true;
      
      const courseNameEl = document.getElementById("courseName");
      const completedBadge = document.getElementById("completedBadge");
      const completeBtn = document.getElementById("completeCourseBtn");
      const deleteBtn = document.getElementById("deleteCourseBtn");
      const assignGroupBtn = document.getElementById("assignGroupBtn");
      const addLecturesCard = document.getElementById("addLecturesCard");
      const addTestsCard = document.getElementById("addTestsCard");
      const courseInfoCard = document.getElementById("courseInfoCard");
      
      courseNameEl.innerHTML = `Курс: ${courseData.name || "Без названия"}`;
      
      if (isCompleted) {
        courseNameEl.innerHTML += ' <span class="badge-completed">Завершен</span>';
        completedBadge.style.display = "inline-block";
        
        if (completeBtn) completeBtn.style.display = "none";
        if (assignGroupBtn) assignGroupBtn.disabled = true;
        if (addLecturesCard) addLecturesCard.style.opacity = "0.5";
        if (addTestsCard) addTestsCard.style.opacity = "0.5";
        if (courseInfoCard) courseInfoCard.classList.add("course-completed");
        
        document.querySelectorAll('.btn-success, .btn-primary').forEach(btn => {
          if (btn.id !== 'deleteCourseBtn') {
            btn.disabled = true;
          }
        });
      } else {
        completedBadge.style.display = "none";
        
        if (completeBtn) completeBtn.style.display = "inline-block";
        if (assignGroupBtn) assignGroupBtn.disabled = false;
        if (addLecturesCard) addLecturesCard.style.opacity = "1";
        if (addTestsCard) addTestsCard.style.opacity = "1";
        if (courseInfoCard) courseInfoCard.classList.remove("course-completed");
        
        document.querySelectorAll('.btn-success, .btn-primary').forEach(btn => {
          if (btn.id !== 'deleteCourseBtn') {
            btn.disabled = false;
          }
        });
      }
    }
  });
}

function loadAllGroups() {
  db.collection("groups").orderBy("name").onSnapshot(snap => {
    const groupSelect = document.getElementById("groupSelect");
    groupSelect.innerHTML = '<option value="">Выберите группу</option>';
    
    if (snap.empty) {
      groupSelect.innerHTML = '<option value="">Нет доступных групп</option>';
      return;
    }
    
    snap.forEach(doc => {
      const group = doc.data();
      groupSelect.innerHTML += `<option value="${doc.id}">${group.name}</option>`;
    });
  });
}

function loadAllLectures() {
  db.collection("lections").orderBy("num").onSnapshot(snap => {
    const dropdownMenu = document.getElementById("lectureDropdownMenu");
    
    if (snap.empty) {
      dropdownMenu.innerHTML = '<div class="dropdown-item text-muted">Нет доступных лекций</div>';
      return;
    }
    
    lecturesData = [];
    let html = '';
    
    snap.forEach(doc => {
      const lecture = doc.data();
      const lectureId = doc.id;
      lecturesData.push({ id: lectureId, ...lecture });
      
      html += `
        <div class="dropdown-item d-flex align-items-center">
          <input type="checkbox" class="custom-checkbox mr-2 lecture-checkbox" 
                 data-lecture-id="${lectureId}" 
                 onchange="updateLectureSelection('${lectureId}', this.checked)">
          <span>Лекция ${lecture.num}: ${lecture.name}</span>
        </div>
      `;
    });
    
    dropdownMenu.innerHTML = html;
  });
}

function loadAllTests() {
  const dropdownMenu = document.getElementById("testDropdownMenu");
  dropdownMenu.innerHTML = '<div class="dropdown-item text-muted">Загрузка тестов...</div>';

  db.collection("tests").onSnapshot(snap => {
    if (snap.empty) {
      dropdownMenu.innerHTML = '<div class="dropdown-item text-muted">Нет доступных тестов</div>';
      return;
    }

    testsData = [];

    const testsBySemester = {
      1: [],
      2: [],
      3: []
    };

    snap.forEach(doc => {
      const test = doc.data();
      const semester = Number(test.semester) || 1;

      const item = {
        id: doc.id,
        ...test,
        semester
      };

      testsData.push(item);

      if (!testsBySemester[semester]) {
        testsBySemester[semester] = [];
      }

      testsBySemester[semester].push(item);
    });

    Object.keys(testsBySemester).forEach(semester => {
      testsBySemester[semester].sort((a, b) => Number(a.num || 0) - Number(b.num || 0));
    });

    let html = `
      <div class="test-semester-tabs mb-2">
        <button type="button" class="btn btn-sm btn-info active" onclick="showTestSemester(1, this)">1 семестр</button>
        <button type="button" class="btn btn-sm btn-outline-info" onclick="showTestSemester(2, this)">2 семестр</button>
        <button type="button" class="btn btn-sm btn-outline-info" onclick="showTestSemester(3, this)">3 семестр</button>
      </div>
    `;

    [1, 2, 3].forEach(semester => {
      html += `
        <div class="test-semester-panel" id="testSemester${semester}" style="${semester === 1 ? '' : 'display:none;'}">
      `;

      if (testsBySemester[semester].length === 0) {
        html += `<div class="dropdown-item text-muted">Нет тестов за ${semester} семестр</div>`;
      } else {
        testsBySemester[semester].forEach(test => {
          html += `
            <label class="dropdown-item">
              <input
                type="checkbox"
                class="test-checkbox"
                value="${test.id}"
                onchange="updateTestSelection('${test.id}', this.checked)"
              >
              Тест ${test.num || ''}: ${test.title || 'Без названия'}
            </label>
          `;
        });
      }

      html += `</div>`;
    });

    dropdownMenu.innerHTML = html;

  }, error => {
    console.error("Ошибка загрузки тестов:", error);
    dropdownMenu.innerHTML = `
      <div class="dropdown-item text-danger">
        Ошибка загрузки тестов: ${error.message}
      </div>
    `;
  });
}

function showTestSemester(semester, btn) {
  document.querySelectorAll('.test-semester-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const panel = document.getElementById(`testSemester${semester}`);
  if (panel) {
    panel.style.display = 'block';
  }

  document.querySelectorAll('.test-semester-tabs button').forEach(button => {
    button.classList.remove('btn-info', 'active');
    button.classList.add('btn-outline-info');
  });

  btn.classList.remove('btn-outline-info');
  btn.classList.add('btn-info', 'active');
}

function showTestSemester(semester, btn) {
  document.querySelectorAll('.test-semester-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const activePanel = document.getElementById(`testSemester${semester}`);
  if (activePanel) {
    activePanel.style.display = 'block';
  }

  document.querySelectorAll('.test-semester-tabs button').forEach(button => {
    button.classList.remove('btn-info', 'active');
    button.classList.add('btn-outline-info');
  });

  btn.classList.remove('btn-outline-info');
  btn.classList.add('btn-info', 'active');
}

function showTestSemester(semester, btn) {
  document.querySelectorAll('.test-semester-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const activePanel = document.getElementById(`testSemester${semester}`);
  if (activePanel) {
    activePanel.style.display = 'block';
  }

  document.querySelectorAll('.test-semester-tabs button').forEach(button => {
    button.classList.remove('btn-info', 'active');
    button.classList.add('btn-outline-info');
  });

  btn.classList.remove('btn-outline-info');
  btn.classList.add('btn-info', 'active');
}

function loadAssignedGroups() {
  db.collection("course_groups")
    .where("courseId", "==", courseId)
    .onSnapshot(snap => {
      const assignedGroupsContainer = document.getElementById("assignedGroups");
      assignedGroupsContainer.innerHTML = "";
      
      if (snap.empty) {
        assignedGroupsContainer.innerHTML = '<p class="text-muted">Группы не назначены</p>';
        return;
      }

      // ИСПРАВЛЕНИЕ: Используем Map для уникальных групп
      const uniqueGroupsMap = new Map();
      const courseGroups = [];
      
      snap.forEach(doc => {
        const courseGroup = doc.data();
        const groupId = courseGroup.groupId;
        
        if (!uniqueGroupsMap.has(groupId)) {
          uniqueGroupsMap.set(groupId, true);
          courseGroup.id = doc.id;
          courseGroups.push(courseGroup);
        }
      });

      const groupPromises = courseGroups.map(courseGroup => 
        db.collection("groups").doc(courseGroup.groupId).get()
      );

      Promise.all(groupPromises).then(groupSnaps => {
        assignedGroupsContainer.innerHTML = "";
        
        groupSnaps.forEach((groupSnap, index) => {
          if (groupSnap.exists) {
            const groupData = groupSnap.data();
            const courseGroup = courseGroups[index];
            
            const groupBadge = document.createElement("div");
            groupBadge.className = "assigned-group";
            groupBadge.innerHTML = `
              <strong>${groupData.name}</strong>
              <small class="text-muted ml-2">Семестр: ${courseGroup.semester}</small>
              <button class="btn btn-sm btn-outline-danger ml-2" onclick="removeGroupFromCourse('${courseGroup.id}')" id="removeGroup-${courseGroup.id}">×</button>
            `;
            assignedGroupsContainer.appendChild(groupBadge);
          }
        });
      });
    });
}

// ИСПРАВЛЕНИЕ: Функция загрузки тестов с уникальными тестами
function loadCourseTests() {
  db.collection("test_course")
    .where("courseId", "==", courseId)
    .onSnapshot(async (snap) => {
      const container = document.getElementById("testsContainer");
      container.innerHTML = "";

      if (snap.empty) {
        container.innerHTML = "<p class='text-muted text-center'>К курсу не привязано тестов</p>";
        return;
      }

      // ИСПРАВЛЕНИЕ: Используем Map для уникальных тестов по testId
      const uniqueTestsMap = new Map();
      
      snap.forEach(doc => {
        const testCourse = doc.data();
        const testId = testCourse.testId;
        
        // Если тест еще не добавлен, добавляем его
        if (!uniqueTestsMap.has(testId)) {
          uniqueTestsMap.set(testId, {
            id: doc.id,
            testId: testId,
            courseId: testCourse.courseId,
            assignedAt: testCourse.assignedAt
          });
        } else {
          console.log('Найден дубликат теста:', testId);
        }
      });

      const testPromises = [];
      const testCourseData = [];
      
      uniqueTestsMap.forEach((value, testId) => {
        testCourseData.push(value);
        testPromises.push(db.collection("tests").doc(testId).get());
      });

      try {
        const testSnaps = await Promise.all(testPromises);
        container.innerHTML = "";
        
        testSnaps.forEach((testSnap, index) => {
          if (testSnap.exists) {
            const testData = testSnap.data();
            const testCourse = testCourseData[index];
            
            const testDiv = document.createElement("div");
            testDiv.className = "test-item";
            testDiv.innerHTML = `
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h5 class="text-primary mb-3">${testData.title || "Без названия теста"}</h5>
                  <div id="parts-${testSnap.id}">
                    <div class="text-muted">Загрузка разделов...</div>
                  </div>
                </div>
                <div>
                  <button class="btn btn-outline-danger btn-sm" onclick="removeTestFromCourse('${testCourse.id}')" id="removeTest-${testCourse.id}">
                    Удалить
                  </button>
                </div>
              </div>
            `;
            container.appendChild(testDiv);
            
            loadTestParts(testSnap.id, testData);
          }
        });

        // Если были дубликаты, показываем предупреждение
        if (snap.size > uniqueTestsMap.size) {
          console.warn(`Обнаружено ${snap.size - uniqueTestsMap.size} дублирующихся записей тестов`);
        }

      } catch (error) {
        console.error("Ошибка загрузки тестов:", error);
        container.innerHTML = `<p class="text-danger text-center">Ошибка загрузки тестов: ${error.message}</p>`;
      }
    });
}

async function loadTestParts(testId, testData) {
  const partsContainer = document.getElementById(`parts-${testId}`);
  
  try {
    const partsSnap = await db.collection("tests").doc(testId).collection("parts").orderBy("num").get();
    
    if (partsSnap.empty) {
      partsContainer.innerHTML = `<p class="ml-3 text-muted">Нет разделов</p>`;
    } else {
      partsContainer.innerHTML = "";
      partsSnap.forEach(partDoc => {
        const part = partDoc.data();
        const partDiv = document.createElement("div");
        partDiv.className = "part-item";
        partDiv.innerHTML = `
          <strong>Часть ${part.num}: ${part.title}</strong>
        `;
        partsContainer.appendChild(partDiv);
      });
    }
  } catch (error) {
    partsContainer.innerHTML = `<p class="text-danger">Ошибка загрузки разделов</p>`;
  }
}

function loadCourseLectures() {
  db.collection("lecture_course")
    .where("courseId", "==", courseId)
    .onSnapshot(async (snap) => {
      const container = document.getElementById("lecturesContainer");
      container.innerHTML = "";
      
      if (snap.empty) {
        container.innerHTML = "<p class='text-muted text-center'>К курсу не привязано лекций</p>";
        return;
      }

      // ИСПРАВЛЕНИЕ: Используем Map для уникальных лекций
      const uniqueLecturesMap = new Map();
      
      snap.forEach(doc => {
        const lectureCourse = doc.data();
        const lectureId = lectureCourse.lectureId;
        
        if (!uniqueLecturesMap.has(lectureId)) {
          uniqueLecturesMap.set(lectureId, {
            id: doc.id,
            lectureId: lectureId,
            courseId: lectureCourse.courseId,
            assignedAt: lectureCourse.assignedAt
          });
        }
      });

      const lecturePromises = [];
      const lectureCourseData = [];
      
      uniqueLecturesMap.forEach((value, lectureId) => {
        lectureCourseData.push(value);
        lecturePromises.push(db.collection("lections").doc(lectureId).get());
      });

      try {
        const lectureSnaps = await Promise.all(lecturePromises);
        container.innerHTML = "";
        
        lectureSnaps.forEach((lectureSnap, index) => {
          if (lectureSnap.exists) {
            const lectureData = lectureSnap.data();
            const lectureCourse = lectureCourseData[index];
            
            const div = document.createElement("div");
            div.className = "lecture-item";
            div.innerHTML = `
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <strong>${lectureData.name || "Без названия"}</strong>
                  ${lectureData.num ? `<small class="text-muted"> — №${lectureData.num}</small>` : ""}
                  ${lectureData.url ? `<br><a href="${lectureData.url}" target="_blank" class="text-success">Открыть материал</a>` : ""}
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="removeLectureFromCourse('${lectureCourse.id}')" id="removeLecture-${lectureCourse.id}">
                  Удалить
                </button>
              </div>
            `;
            container.appendChild(div);
          }
        });
      } catch (error) {
        console.error("Ошибка загрузки лекций:", error);
        container.innerHTML = `<p class="text-danger text-center">Ошибка загрузки лекций: ${error.message}</p>`;
      }
    });
}

function updateLectureSelection(lectureId, isSelected) {
  if (isSelected) {
    selectedLectures.add(lectureId);
  } else {
    selectedLectures.delete(lectureId);
  }
  updateSelectedLecturesText();
}

function updateSelectedLecturesText() {
  const count = selectedLectures.size;
  
  if (count === 0) {
    document.getElementById('selectedLecturesText').textContent = 'Выберите лекции...';
  } else {
    const selectedNames = [];
    lecturesData.forEach(lecture => {
      if (selectedLectures.has(lecture.id)) {
        selectedNames.push(`Лекция ${lecture.num}`);
      }
    });
    
    if (selectedNames.length <= 2) {
      document.getElementById('selectedLecturesText').textContent = selectedNames.join(', ');
    } else {
      document.getElementById('selectedLecturesText').textContent = `Выбрано ${count} лекций`;
    }
  }
}

function updateTestSelection(testId, isSelected) {
  if (isSelected) {
    selectedTests.add(testId);
  } else {
    selectedTests.delete(testId);
  }
  updateSelectedTestsText();
}

function updateSelectedTestsText() {
  const count = selectedTests.size;
  
  if (count === 0) {
    document.getElementById('selectedTestsText').textContent = 'Выберите тесты...';
  } else {
    const selectedNames = [];
    testsData.forEach(test => {
      if (selectedTests.has(test.id)) {
        selectedNames.push(`Тест ${test.num}`);
      }
    });
    
    if (selectedNames.length <= 2) {
      document.getElementById('selectedTestsText').textContent = selectedNames.join(', ');
    } else {
      document.getElementById('selectedTestsText').textContent = `Выбрано ${count} тестов`;
    }
  }
}

async function addSelectedLectures() {
  if (selectedLectures.size === 0) {
    alert('Выберите хотя бы одну лекцию');
    return;
  }

  const courseDoc = await db.collection("courses").doc(courseId).get();
  if (courseDoc.exists && courseDoc.data().completed === true) {
    alert('Нельзя добавлять лекции в завершенный курс');
    return;
  }

  const addBtn = document.getElementById('addLecturesBtnText');
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Добавление...';

  try {
    const promises = [];
    
    for (const lectureId of selectedLectures) {
      const existing = await db.collection("lecture_course")
        .where("courseId", "==", courseId)
        .where("lectureId", "==", lectureId)
        .get();
      
      if (existing.empty) {
        promises.push(
          db.collection("lecture_course").add({
            courseId: courseId,
            lectureId: lectureId,
            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
          })
        );
      }
    }

    await Promise.all(promises);
    
    document.querySelectorAll('.lecture-checkbox').forEach(cb => {
      cb.checked = false;
    });
    selectedLectures.clear();
    updateSelectedLecturesText();
    
    alert(`Успешно добавлено ${promises.length} лекций`);
    
  } catch (error) {
    console.error("Ошибка добавления лекций:", error);
    alert("Ошибка добавления лекций: " + error.message);
  } finally {
    addBtn.innerHTML = originalText;
  }
}

async function addSelectedTests() {
  console.log("Выбранные тесты для добавления:", Array.from(selectedTests));
  
  if (selectedTests.size === 0) {
    alert('Выберите хотя бы один тест');
    return;
  }

  const courseDoc = await db.collection("courses").doc(courseId).get();
  if (courseDoc.exists && courseDoc.data().completed === true) {
    alert('Нельзя добавлять тесты в завершенный курс');
    return;
  }

  const addBtn = document.getElementById('addTestsBtnText');
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Добавление...';
  addBtn.disabled = true;

  try {
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const testId of selectedTests) {
      console.log(`Обработка теста с ID: ${testId}`);
      
      // Проверяем, существует ли тест
      const testDoc = await db.collection("tests").doc(testId).get();
      if (!testDoc.exists) {
        console.warn(`Тест с ID ${testId} не существует в коллекции tests`);
        skippedCount++;
        continue;
      }
      
      console.log(`Тест найден: ${testDoc.data().title}`);
      
      // Проверяем, не привязан ли уже тест к курсу
      const existingQuery = await db.collection("test_course")
        .where("courseId", "==", courseId)
        .where("testId", "==", testId)
        .get();
      
      if (existingQuery.empty) {
        // Добавляем тест к курсу
        await db.collection("test_course").add({
          courseId: courseId,
          testId: testId,
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Тест ${testId} успешно добавлен к курсу`);
        addedCount++;
      } else {
        console.log(`Тест ${testId} уже привязан к курсу`);
        skippedCount++;
      }
    }

    // Очищаем выбранные чекбоксы
    document.querySelectorAll('.test-checkbox').forEach(cb => {
      cb.checked = false;
    });
    selectedTests.clear();
    updateSelectedTestsText();
    
    if (addedCount > 0) {
      alert(`Успешно добавлено ${addedCount} тестов${skippedCount > 0 ? `, пропущено (уже добавлены): ${skippedCount}` : ''}`);
    } else if (skippedCount > 0) {
      alert(`Все выбранные тесты уже добавлены к курсу (${skippedCount} шт.)`);
    } else {
      alert("Не удалось добавить тесты. Проверьте консоль для деталей.");
    }
    
  } catch (error) {
    console.error("Ошибка добавления тестов:", error);
    alert("Ошибка добавления тестов: " + error.message);
  } finally {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
  }
}

function assignGroupToCourse() {
  const groupId = document.getElementById("groupSelect").value;
  const semester = document.getElementById("semesterInput").value;
  
  if (!groupId) {
    alert("Выберите группу");
    return;
  }
  
  if (!semester) {
    alert("Введите номер семестра");
    return;
  }

  db.collection("courses").doc(courseId).get().then(doc => {
    if (doc.exists && doc.data().completed === true) {
      alert('Нельзя добавлять группы в завершенный курс');
      return;
    }

    db.collection("course_groups")
      .where("courseId", "==", courseId)
      .where("groupId", "==", groupId)
      .get()
      .then(snap => {
        if (!snap.empty) {
          alert("Эта группа уже назначена данному курсу");
          document.getElementById("semesterInput").value = "";
          return;
        }

        db.collection("course_groups").add({
          courseId: courseId,
          groupId: groupId,
          semester: parseInt(semester),
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
          document.getElementById("semesterInput").value = "";
          alert("Группа успешно назначена курсу");
        }).catch(error => {
          alert("Ошибка назначения группы: " + error.message);
        });
      });
  });
}

function removeGroupFromCourse(courseGroupId) {
  if (confirm("Вы уверены, что хотите удалить группу из этого курса?")) {
    db.collection("course_groups").doc(courseGroupId).delete()
      .catch(error => {
        alert("Ошибка удаления группы: " + error.message);
      });
  }
}

function removeTestFromCourse(testCourseId) {
  if (confirm("Вы уверены, что хотите удалить тест из этого курса?")) {
    db.collection("test_course").doc(testCourseId).delete()
      .catch(error => {
        alert("Ошибка удаления теста: " + error.message);
      });
  }
}

function removeLectureFromCourse(lectureCourseId) {
  if (confirm("Вы уверены, что хотите удалить лекцию из этого курса?")) {
    db.collection("lecture_course").doc(lectureCourseId).delete()
      .catch(error => {
        alert("Ошибка удаления лекции: " + error.message);
      });
  }
}

function confirmCompleteCourse() {
  $('#completeCourseModal').modal('show');
}

async function completeCourse() {
  const confirmBtn = document.getElementById('confirmCompleteBtn');
  const originalText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Завершение...';
  confirmBtn.disabled = true;

  try {
    const courseGroupsSnap = await db.collection("course_groups")
      .where("courseId", "==", courseId)
      .get();

    if (courseGroupsSnap.empty) {
      alert('К курсу не привязаны группы');
      return;
    }

    const courseTestsSnap = await db.collection("test_course")
      .where("courseId", "==", courseId)
      .get();

    if (courseTestsSnap.empty) {
      alert('К курсу не привязаны тесты');
      return;
    }

    // ИСПРАВЛЕНИЕ: Используем Set для уникальных testId
    const uniqueTestIds = new Set();
    courseTestsSnap.forEach(doc => {
      uniqueTestIds.add(doc.data().testId);
    });
    const testIds = Array.from(uniqueTestIds);
    
    const courseDoc = await db.collection("courses").doc(courseId).get();
    const courseName = courseDoc.data().name || 'Неизвестный курс';
    
    // ИСПРАВЛЕНИЕ: Используем Map для уникальных групп
    const uniqueGroupsMap = new Map();
    courseGroupsSnap.forEach(doc => {
      const groupData = doc.data();
      if (!uniqueGroupsMap.has(groupData.groupId)) {
        uniqueGroupsMap.set(groupData.groupId, groupData);
      }
    });
    
    for (const [groupId, groupData] of uniqueGroupsMap) {
      const groupDoc = await db.collection("groups").doc(groupId).get();
      const groupName = groupDoc.exists ? groupDoc.data().name : 'Неизвестная группа';

      const studentsSnap = await db.collection("usersgroup")
        .where("groupId", "==", groupId)
        .get();

      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        const studentId = studentData.userId;
        const studentName = studentData.userName || studentData.name || studentId;

        let totalScore = 0;
        let testsCount = 0;

        for (const testId of testIds) {
          const gradesSnap = await db.collection("test_grades")
            .where("userId", "==", studentId)
            .where("testId", "==", testId)
            .get();

          if (!gradesSnap.empty) {
            let bestScore = 0;
            gradesSnap.forEach(doc => {
              const grade = doc.data();
              if (grade.bestScore && grade.bestScore > bestScore) {
                bestScore = grade.bestScore;
              }
            });
            
            if (bestScore > 0) {
              totalScore += bestScore;
              testsCount++;
            }
          }
        }

        const avgScore = testsCount > 0 ? totalScore / testsCount : 0;

        if (avgScore < 60) {
          const existingDebtSnap = await db.collection("dolg")
            .where("studentId", "==", studentId)
            .where("courseId", "==", courseId)
            .get();

          if (existingDebtSnap.empty) {
            await db.collection("dolg").add({
              studentId: studentId,
              studentName: studentName,
              groupId: groupId,
              groupName: groupName,
              courseId: courseId,
              courseName: courseName,
              avgScore: avgScore,
              testsCompleted: testsCount,
              totalTests: testIds.length,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              status: 'active'
            });
            
            console.log(`Добавлен должник: ${studentName} (средний балл: ${avgScore})`);
          }
        }
      }
    }

    await db.collection("courses").doc(courseId).update({
      completed: true,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completedBy: localStorage.getItem('teacherId')
    });

    $('#completeCourseModal').modal('hide');
    alert('Курс успешно завершен. Студенты с неудовлетворительными оценками добавлены в список должников.');
    
    checkCourseStatus();
    
  } catch (error) {
    console.error("Ошибка завершения курса:", error);
    alert('Ошибка завершения курса: ' + error.message);
  } finally {
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

function confirmDeleteCourse() {
  $('#deleteCourseModal').modal('show');
}

async function deleteCourse() {
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  const originalText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Удаление...';
  confirmBtn.disabled = true;

  try {
    const courseGroupsSnap = await db.collection("course_groups")
      .where("courseId", "==", courseId)
      .get();
    
    const deleteCourseGroups = courseGroupsSnap.docs.map(doc => 
      db.collection("course_groups").doc(doc.id).delete()
    );

    const lectureCourseSnap = await db.collection("lecture_course")
      .where("courseId", "==", courseId)
      .get();
    
    const deleteLectureCourse = lectureCourseSnap.docs.map(doc => 
      db.collection("lecture_course").doc(doc.id).delete()
    );

    const testCourseSnap = await db.collection("test_course")
      .where("courseId", "==", courseId)
      .get();
    
    const deleteTestCourse = testCourseSnap.docs.map(doc => 
      db.collection("test_course").doc(doc.id).delete()
    );

    const dolgSnap = await db.collection("dolg")
      .where("courseId", "==", courseId)
      .get();
    
    const deleteDolg = dolgSnap.docs.map(doc => 
      db.collection("dolg").doc(doc.id).delete()
    );

    await Promise.all([
      ...deleteCourseGroups,
      ...deleteLectureCourse,
      ...deleteTestCourse,
      ...deleteDolg
    ]);

    await db.collection("courses").doc(courseId).delete();

    $('#deleteCourseModal').modal('hide');
    alert('Курс успешно удален');
    
    window.location.href = './courses.html';
    
  } catch (error) {
    console.error("Ошибка удаления курса:", error);
    alert('Ошибка удаления курса: ' + error.message);
  } finally {
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

// ВРЕМЕННАЯ ФУНКЦИЯ для очистки дубликатов (вызовите один раз в консоли)
async function cleanupDuplicateTests() {
  try {
    // Получаем все записи test_course для этого курса
    const snapshot = await db.collection("test_course")
      .where("courseId", "==", courseId)
      .get();
    
    const uniqueTests = new Map();
    const duplicates = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const key = data.testId;
      
      if (uniqueTests.has(key)) {
        duplicates.push(doc.id);
        console.log('Найден дубликат:', doc.id, data);
      } else {
        uniqueTests.set(key, doc.id);
      }
    });
    
    console.log(`Найдено дубликатов: ${duplicates.length}`);
    
    // Удаляем дубликаты
    for (const docId of duplicates) {
      await db.collection("test_course").doc(docId).delete();
      console.log('Удален дубликат:', docId);
    }
    
    alert(`Очистка завершена. Удалено ${duplicates.length} дубликатов`);
    
  } catch (error) {
    console.error("Ошибка очистки:", error);
    alert("Ошибка: " + error.message);
  }
}