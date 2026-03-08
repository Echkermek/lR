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

async function loadGroupsWithDebts() {
  try {
    const debtsSnapshot = await db.collection("dolg")
      .where("status", "==", "active")
      .get();

    if (debtsSnapshot.empty) {
      document.getElementById('groupsList').innerHTML = `
        <div class="empty-state">
          <h4>Нет активных долгов</h4>
        </div>
      `;
      return;
    }

    const groupsMap = new Map();

    debtsSnapshot.forEach(doc => {
      const debt = doc.data();
      const groupId = debt.groupId;
      const groupName = debt.groupName;

      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          id: groupId,
          name: groupName
        });
      }
    });

    renderGroups(groupsMap);

  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    document.getElementById('groupsList').innerHTML = `
      <div class="empty-state text-danger">
        <h4>Ошибка загрузки данных</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderGroups(groupsMap) {
  const container = document.getElementById('groupsList');
  container.innerHTML = "";

  const sortedGroups = [...groupsMap.entries()].sort((a, b) => 
    a[1].name.localeCompare(b[1].name)
  );

  for (const [groupId, group] of sortedGroups) {
    const groupCard = document.createElement('div');
    groupCard.className = 'group-card';
    groupCard.innerHTML = `<h4>${group.name}</h4>`;
    
    groupCard.addEventListener('click', () => {
      localStorage.setItem('debtGroupId', groupId);
      localStorage.setItem('debtGroupName', group.name);
      window.location.href = './group-debtors.html';
    });

    container.appendChild(groupCard);
  }
}

loadGroupsWithDebts();