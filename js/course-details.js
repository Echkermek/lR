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
  console.log('DOM загружен, courseId:', courseId);
  loadCourseGrades();
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
      
      if (courseNameEl) {
        courseNameEl.innerHTML = `Курс: ${courseData.name || "Без названия"}`;
      }
      
      if (isCompleted) {
        if (courseNameEl) courseNameEl.innerHTML += ' <span class="badge-completed">Завершен</span>';
        if (completedBadge) completedBadge.style.display = "inline-block";
        
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
        if (completedBadge) completedBadge.style.display = "none";
        
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
    if (!groupSelect) return;
    
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
  const dropdownMenu = document.getElementById("lectureDropdownMenu");
  if (!dropdownMenu) return;
  
  dropdownMenu.innerHTML = '<div class="dropdown-item text-muted">Загрузка лекций...</div>';

  db.collection("lections").onSnapshot(snap => {
    if (snap.empty) {
      dropdownMenu.innerHTML = '<div class="dropdown-item text-muted">Нет доступных лекций</div>';
      return;
    }

    lecturesData = [];

    const lecturesBySemester = {
      1: [],
      2: [],
      3: []
    };

    snap.forEach(doc => {
      const lecture = doc.data();
      const sem = Number(lecture.sem) || 1;

      const item = {
        id: doc.id,
        ...lecture,
        sem
      };

      lecturesData.push(item);

      if (!lecturesBySemester[sem]) {
        lecturesBySemester[sem] = [];
      }

      lecturesBySemester[sem].push(item);
    });

    Object.keys(lecturesBySemester).forEach(sem => {
      lecturesBySemester[sem].sort((a, b) => Number(a.num || 0) - Number(b.num || 0));
    });

    let html = `
      <div class="lecture-semester-tabs mb-2">
        <button type="button" class="btn btn-sm btn-info active" onclick="showLectureSemester(1, this)">1 семестр</button>
        <button type="button" class="btn btn-sm btn-outline-info" onclick="showLectureSemester(2, this)">2 семестр</button>
        <button type="button" class="btn btn-sm btn-outline-info" onclick="showLectureSemester(3, this)">3 семестр</button>
      </div>
    `;

    [1, 2, 3].forEach(sem => {
      html += `<div class="lecture-semester-panel" id="lectureSemester${sem}" style="${sem === 1 ? '' : 'display:none;'}">`;

      if (lecturesBySemester[sem].length === 0) {
        html += `<div class="dropdown-item text-muted">Нет лекций за ${sem} семестр</div>`;
      } else {
        lecturesBySemester[sem].forEach(lecture => {
          html += `
            <label class="dropdown-item">
              <input 
                type="checkbox"
                class="lecture-checkbox"
                value="${lecture.id}"
                onchange="updateLectureSelection('${lecture.id}', this.checked)"
              >
              Лекция ${lecture.num || ''}: ${lecture.name || 'Без названия'}
            </label>
          `;
        });
      }

      html += `</div>`;
    });

    dropdownMenu.innerHTML = html;

  }, error => {
    console.error("Ошибка загрузки лекций:", error);
    if (dropdownMenu) {
      dropdownMenu.innerHTML = `
        <div class="dropdown-item text-danger">
          Ошибка загрузки лекций: ${error.message}
        </div>
      `;
    }
  });
}

function showLectureSemester(semester, btn) {
  document.querySelectorAll('.lecture-semester-panel').forEach(panel => {
    panel.style.display = 'none';
  });

  const panel = document.getElementById(`lectureSemester${semester}`);
  if (panel) {
    panel.style.display = 'block';
  }

  document.querySelectorAll('.lecture-semester-tabs button').forEach(button => {
    button.classList.remove('btn-info', 'active');
    button.classList.add('btn-outline-info');
  });

  btn.classList.remove('btn-outline-info');
  btn.classList.add('btn-info', 'active');
}

function loadAllTests() {
  const dropdownMenu = document.getElementById("testDropdownMenu");
  if (!dropdownMenu) return;
  
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
    if (dropdownMenu) {
      dropdownMenu.innerHTML = `
        <div class="dropdown-item text-danger">
          Ошибка загрузки тестов: ${error.message}
        </div>
      `;
    }
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

function loadAssignedGroups() {
  const assignedGroupsContainer = document.getElementById("assignedGroups");
  if (!assignedGroupsContainer) return;
  
  assignedGroupsContainer.innerHTML = '<div class="text-center"><div class="spinner-border spinner-border-sm text-primary" role="status"></div><span class="ml-2">Загрузка групп...</span></div>';
  
  // Получаем семестр курса
  let courseSemester = null;
  db.collection("courses").doc(courseId).get().then(courseDoc => {
    if (courseDoc.exists) {
      courseSemester = courseDoc.data().semester;
    }
  }).catch(error => {
    console.error("Ошибка загрузки курса:", error);
  });
  
  db.collection("course_groups")
    .where("courseId", "==", courseId)
    .onSnapshot(snap => {
      if (!assignedGroupsContainer) return;
      
      assignedGroupsContainer.innerHTML = "";
      
      if (snap.empty) {
        assignedGroupsContainer.innerHTML = '<p class="text-muted">Группы не назначены</p>';
        return;
      }

      // Используем Map для уникальных групп
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
        db.collection("groups").doc(courseGroup.groupId).get().catch(err => {
          console.error(`Ошибка загрузки группы ${courseGroup.groupId}:`, err);
          return null;
        })
      );

      Promise.all(groupPromises).then(groupSnaps => {
        assignedGroupsContainer.innerHTML = "";
        
        groupSnaps.forEach((groupSnap, index) => {
          if (groupSnap && groupSnap.exists) {
            const groupData = groupSnap.data();
            const courseGroup = courseGroups[index];
            const semesterToShow = courseGroup.semester || courseSemester || '?';
            const isCompleted = courseGroup.completed === true;
            const completedBadge = isCompleted ? '<span class="badge badge-secondary ml-1">Завершен</span>' : '';
            
            const groupBadge = document.createElement("div");
            groupBadge.className = "assigned-group";
            groupBadge.innerHTML = `
              <strong>${groupData.name}</strong>
              <small class="text-muted ml-2">Семестр: ${semesterToShow}</small>
              ${completedBadge}
              <button class="btn btn-sm btn-outline-danger ml-2" onclick="removeGroupFromCourse('${courseGroup.id}')" id="removeGroup-${courseGroup.id}" ${isCompleted ? 'disabled style="opacity:0.5"' : ''}>×</button>
            `;
            assignedGroupsContainer.appendChild(groupBadge);
          }
        });
      }).catch(error => {
        console.error("Ошибка загрузки групп:", error);
        assignedGroupsContainer.innerHTML = '<p class="text-danger">Ошибка загрузки групп</p>';
      });
    }, error => {
      console.error("Ошибка в onSnapshot course_groups:", error);
      if (assignedGroupsContainer) {
        assignedGroupsContainer.innerHTML = '<p class="text-danger">Ошибка загрузки групп</p>';
      }
    });
}

function loadCourseTests() {
  const container = document.getElementById("testsContainer");
  if (!container) return;
  
  container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Загрузка тестов...</p></div>';
  
  db.collection("test_course")
    .where("courseId", "==", courseId)
    .onSnapshot(async (snap) => {
      if (!container) return;
      container.innerHTML = "";

      if (snap.empty) {
        container.innerHTML = "<p class='text-muted text-center'>К курсу не привязано тестов</p>";
        return;
      }

      const uniqueTestsMap = new Map();
      
      snap.forEach(doc => {
        const testCourse = doc.data();
        const testId = testCourse.testId;
        
        if (!uniqueTestsMap.has(testId)) {
          uniqueTestsMap.set(testId, {
            id: doc.id,
            testId: testId,
            courseId: testCourse.courseId,
            assignedAt: testCourse.assignedAt
          });
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
          if (testSnap && testSnap.exists) {
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

      } catch (error) {
        console.error("Ошибка загрузки тестов:", error);
        container.innerHTML = `<p class="text-danger text-center">Ошибка загрузки тестов: ${error.message}</p>`;
      }
    });
}

async function loadTestParts(testId, testData) {
  const partsContainer = document.getElementById(`parts-${testId}`);
  if (!partsContainer) return;
  
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
  const container = document.getElementById("lecturesContainer");
  if (!container) return;
  
  container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Загрузка лекций...</p></div>';
  
  db.collection("lecture_course")
    .where("courseId", "==", courseId)
    .onSnapshot(async (snap) => {
      if (!container) return;
      container.innerHTML = "";
      
      if (snap.empty) {
        container.innerHTML = "<p class='text-muted text-center'>К курсу не привязано лекций</p>";
        return;
      }

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
          if (lectureSnap && lectureSnap.exists) {
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
  const textElement = document.getElementById('selectedLecturesText');
  if (!textElement) return;
  
  if (count === 0) {
    textElement.textContent = 'Выберите лекции...';
  } else {
    const selectedNames = [];
    lecturesData.forEach(lecture => {
      if (selectedLectures.has(lecture.id)) {
        selectedNames.push(`Лекция ${lecture.num}`);
      }
    });
    
    if (selectedNames.length <= 2) {
      textElement.textContent = selectedNames.join(', ');
    } else {
      textElement.textContent = `Выбрано ${count} лекций`;
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
  const textElement = document.getElementById('selectedTestsText');
  if (!textElement) return;
  
  if (count === 0) {
    textElement.textContent = 'Выберите тесты...';
  } else {
    const selectedNames = [];
    testsData.forEach(test => {
      if (selectedTests.has(test.id)) {
        selectedNames.push(`Тест ${test.num}`);
      }
    });
    
    if (selectedNames.length <= 2) {
      textElement.textContent = selectedNames.join(', ');
    } else {
      textElement.textContent = `Выбрано ${count} тестов`;
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

  // ИСПРАВЛЕНО: правильный ID элемента
  const addBtn = document.getElementById('addLecturesBtn');
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = 'Добавление...';
  addBtn.disabled = true;

  try {
    let addedCount = 0;
    for (const lectureId of selectedLectures) {
      const existing = await db.collection("lecture_course")
        .where("courseId", "==", courseId)
        .where("lectureId", "==", lectureId)
        .get();
      
      if (existing.empty) {
        await db.collection("lecture_course").add({
          courseId: courseId,
          lectureId: lectureId,
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addedCount++;
      }
    }
    
    document.querySelectorAll('.lecture-checkbox').forEach(cb => {
      cb.checked = false;
    });
    selectedLectures.clear();
    updateSelectedLecturesText();
    
    alert(`Успешно добавлено ${addedCount} лекций`);
    
  } catch (error) {
    console.error("Ошибка добавления лекций:", error);
    alert("Ошибка добавления лекций: " + error.message);
  } finally {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
  }
}

async function addSelectedTests() {
  if (selectedTests.size === 0) {
    alert('Выберите хотя бы один тест');
    return;
  }

  const courseDoc = await db.collection("courses").doc(courseId).get();
  if (courseDoc.exists && courseDoc.data().completed === true) {
    alert('Нельзя добавлять тесты в завершенный курс');
    return;
  }

  // ИСПРАВЛЕНО: правильный ID элемента
  const addBtn = document.getElementById('addTestsBtn');
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = 'Добавление...';
  addBtn.disabled = true;

  try {
    let addedCount = 0;
    for (const testId of selectedTests) {
      const existingQuery = await db.collection("test_course")
        .where("courseId", "==", courseId)
        .where("testId", "==", testId)
        .get();
      
      if (existingQuery.empty) {
        await db.collection("test_course").add({
          courseId: courseId,
          testId: testId,
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addedCount++;
      }
    }
    
    document.querySelectorAll('.test-checkbox').forEach(cb => {
      cb.checked = false;
    });
    selectedTests.clear();
    updateSelectedTestsText();
    
    alert(`Успешно добавлено ${addedCount} тестов`);
    
  } catch (error) {
    console.error("Ошибка добавления тестов:", error);
    alert("Ошибка добавления тестов: " + error.message);
  } finally {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
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

  const addBtn = document.getElementById('addTestsBtn');
  if (!addBtn) return;
  
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Добавление...';
  addBtn.disabled = true;

  try {
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const testId of selectedTests) {
      const testDoc = await db.collection("tests").doc(testId).get();
      if (!testDoc.exists) {
        console.warn(`Тест с ID ${testId} не существует`);
        skippedCount++;
        continue;
      }
      
      const existingQuery = await db.collection("test_course")
        .where("courseId", "==", courseId)
        .where("testId", "==", testId)
        .get();
      
      if (existingQuery.empty) {
        await db.collection("test_course").add({
          courseId: courseId,
          testId: testId,
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    document.querySelectorAll('.test-checkbox').forEach(cb => {
      cb.checked = false;
    });
    selectedTests.clear();
    updateSelectedTestsText();
    
    if (addedCount > 0) {
      alert(`Успешно добавлено ${addedCount} тестов${skippedCount > 0 ? `, пропущено: ${skippedCount}` : ''}`);
    } else if (skippedCount > 0) {
      alert(`Все выбранные тесты уже добавлены к курсу (${skippedCount} шт.)`);
    } else {
      alert("Не удалось добавить тесты");
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
  
  if (!groupId) {
    alert("Выберите группу");
    return;
  }

  db.collection("courses").doc(courseId).get().then(doc => {
    if (doc.exists && doc.data().completed === true) {
      alert('Нельзя добавлять группы в завершенный курс');
      return;
    }

    const courseSemester = doc.data().semester;
    
    if (!courseSemester) {
      alert('У курса не указан семестр');
      return;
    }

    db.collection("course_groups")
      .where("courseId", "==", courseId)
      .where("groupId", "==", groupId)
      .get()
      .then(snap => {
        if (!snap.empty) {
          alert("Эта группа уже назначена данному курсу");
          return;
        }

        db.collection("course_groups").add({
          courseId: courseId,
          groupId: groupId,
          semester: courseSemester,
          assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
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

    let gradesConfig = { min3: 50, min4: 66, min5: 77 };
    try {
      const gradesDoc = await db.collection("course_grades").doc(courseId).get();
      if (gradesDoc.exists) {
        gradesConfig = gradesDoc.data();
      }
    } catch (error) {
      console.warn('Не удалось загрузить критерии оценок:', error);
    }

    const uniqueTestIds = new Set();
    courseTestsSnap.forEach(doc => {
      uniqueTestIds.add(doc.data().testId);
    });
    const testIds = Array.from(uniqueTestIds);
    
    const courseDoc = await db.collection("courses").doc(courseId).get();
    const courseName = courseDoc.data().name || 'Неизвестный курс';
    const courseSemester = courseDoc.data().semester;
    
    const uniqueGroupsMap = new Map();
    const courseGroupsToUpdate = [];
    
    courseGroupsSnap.forEach(doc => {
      const groupData = doc.data();
      if (!uniqueGroupsMap.has(groupData.groupId)) {
        uniqueGroupsMap.set(groupData.groupId, groupData);
        courseGroupsToUpdate.push({ id: doc.id, data: groupData });
      }
    });
    
    const updateCourseGroupsPromises = courseGroupsToUpdate.map(item => {
      return db.collection("course_groups").doc(item.id).update({
        completed: true,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(err => {
        console.warn(`Не удалось обновить course_group ${item.id}:`, err);
        return null;
      });
    });
    
    await Promise.all(updateCourseGroupsPromises);
    
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
        const passingThreshold = gradesConfig.min3 || 50;

        if (avgScore < passingThreshold) {
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
              courseSemester: courseSemester,
              avgScore: avgScore,
              testsCompleted: testsCount,
              totalTests: testIds.length,
              passingThreshold: passingThreshold,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              status: 'active'
            });
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
    alert('Курс успешно завершен.');
    
    checkCourseStatus();
    loadAssignedGroups();
    
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

async function cleanupDuplicateTests() {
  try {
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
      } else {
        uniqueTests.set(key, doc.id);
      }
    });
    
    for (const docId of duplicates) {
      await db.collection("test_course").doc(docId).delete();
    }
    
    alert(`Очистка завершена. Удалено ${duplicates.length} дубликатов`);
    
  } catch (error) {
    console.error("Ошибка очистки:", error);
    alert("Ошибка: " + error.message);
  }

  
}

// ========== ФУНКЦИИ ДЛЯ КРИТЕРИЕВ ОЦЕНОК ==========

function loadCourseGrades() {
  const gradesDisplay = document.getElementById('gradesDisplay');
  if (!gradesDisplay) return;
  
  db.collection("course_grades").doc(courseId).get()
    .then(doc => {
      if (doc.exists) {
        const min3 = doc.data().min3 || 50;
        const min4 = doc.data().min4 || 66;
        const min5 = doc.data().min5 || 77;
        
        gradesDisplay.innerHTML = `
          <div>Оценка 3: минимум ${min3} баллов</div>
          <div>Оценка 4: минимум ${min4} баллов</div>
          <div>Оценка 5: минимум ${min5} баллов</div>
        `;
      } else {
        gradesDisplay.innerHTML = '<div class="text-muted">Критерии не установлены</div>';
      }
    })
    .catch(error => {
      console.error("Ошибка загрузки критериев:", error);
      gradesDisplay.innerHTML = '<div class="text-danger">Ошибка загрузки</div>';
    });
}

function showEditGradesModal() {
  db.collection("courses").doc(courseId).get().then(courseDoc => {
    if (courseDoc.exists && courseDoc.data().completed === true) {
      alert('Нельзя изменять критерии завершенного курса');
      return;
    }
    
    db.collection("course_grades").doc(courseId).get()
      .then(doc => {
        if (doc.exists) {
          document.getElementById('editMin3').value = doc.data().min3 || 50;
          document.getElementById('editMin4').value = doc.data().min4 || 66;
          document.getElementById('editMin5').value = doc.data().min5 || 77;
        } else {
          document.getElementById('editMin3').value = 50;
          document.getElementById('editMin4').value = 66;
          document.getElementById('editMin5').value = 77;
        }
        $('#editGradesModal').modal('show');
      })
      .catch(error => {
        alert('Ошибка загрузки критериев: ' + error.message);
      });
  });
}

async function updateCourseGrades() {
  const min3 = parseInt(document.getElementById('editMin3').value);
  const min4 = parseInt(document.getElementById('editMin4').value);
  const min5 = parseInt(document.getElementById('editMin5').value);
  
  if (isNaN(min3) || isNaN(min4) || isNaN(min5)) {
    alert('Введите корректные числовые значения');
    return;
  }
  
  if (min3 < 0 || min4 < 0 || min5 < 0) {
    alert('Значения не могут быть отрицательными');
    return;
  }
  
  if (min3 >= min4 || min4 >= min5) {
    alert('Значения должны быть в порядке возрастания: min3 < min4 < min5');
    return;
  }
  
  const saveBtn = document.getElementById('saveGradesBtn');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = 'Сохранение...';
  saveBtn.disabled = true;
  
  try {
    await db.collection("course_grades").doc(courseId).set({
      courseid: courseId,
      min3: min3,
      min4: min4,
      min5: min5,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    $('#editGradesModal').modal('hide');
    alert('Критерии сохранены');
    loadCourseGrades();
    
  } catch (error) {
    console.error("Ошибка сохранения:", error);
    alert('Ошибка: ' + error.message);
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
}