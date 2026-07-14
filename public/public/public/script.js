let currentUser = null;

function login() {
  const username = document.getElementById('username').value.trim();
  if (!username) return alert('Введи ник');
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  }).then(r => r.json()).then(data => {
    if (data.success) {
      currentUser = username;
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('game-section').style.display = 'block';
      updateBalance();
    }
  });
}

function updateBalance() {
  fetch('/getBalance?user=' + currentUser)
    .then(r => r.json())
    .then(data => document.getElementById('balance').innerText = data.balance);
}

function openCase() {
  fetch('/openCase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: currentUser })
  }).then(r => r.json()).then(data => {
    if (data.error) alert(data.error);
    else {
      document.getElementById('result').innerHTML = `🎉 Выпало: ${data.prize} ₽!`;
      updateBalance();
    }
  });
}

function requestWithdraw() {
  const amount = parseInt(document.getElementById('withdrawAmount').value);
  const wallet = document.getElementById('wallet').value.trim();
  if (!amount || !wallet) return alert('Введи сумму и свой USDT адрес');
  fetch('/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: currentUser, amount, wallet })
  }).then(r => r.json()).then(data => {
    alert(data.message);
    updateBalance();
  });
}

function logout() {
  currentUser = null;
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('game-section').style.display = 'none';
}
