const express = require('express');
const app = express();
const fetch = require('node-fetch'); // встроен в Glitch

app.use(express.json());
app.use(express.static('public'));

// ---------- НАСТРОЙКИ ----------
const ADMIN_LOGIN = 'boss';
const ADMIN_PASS = 'swilladmin2025';
const USDT_ADDRESS = 'TFvfrf1NkM7iKxNkfuYJuMDEHQ8omXyifk'; //
const ROUBLES_PER_USDT = 90;
// --------------------------------

// Хранилище в памяти (сбросится при перезапуске, но для старта ок)
let users = {};
let withdrawRequests = [];

// Админ-панель (HTML прямо здесь)
app.get('/admin', (req, res) => {
  res.send(`
  <html>
  <head><title>Админка Boss</title>
  <style>body{background:#0a0a0a;color:white;font-family:sans-serif;text-align:center;padding:50px;} input,button{padding:10px;margin:10px;}</style>
  </head>
  <body>
    <h2>Вход в админку</h2>
    <input id="login" placeholder="Логин"><br>
    <input id="pass" type="password" placeholder="Пароль"><br>
    <button onclick="login()">Войти</button>
    <div id="panel" style="display:none;">
      <h3>Управление</h3>
      <button onclick="getUsers()">Список юзеров</button>
      <pre id="users"></pre>
      <button onclick="getWithdraws()">Заявки на вывод</button>
      <pre id="withdraws"></pre>
      <p>USDT адрес: ${USDT_ADDRESS}</p>
    </div>
    <script>
      let isAdmin = false;
      function login(){
        if(document.getElementById('login').value==='${ADMIN_LOGIN}' && document.getElementById('pass').value==='${ADMIN_PASS}'){
          isAdmin = true;
          document.getElementById('panel').style.display='block';
        } else alert('Неверные данные');
      }
      async function getUsers(){
        const resp = await fetch('/admin/users?login=${ADMIN_LOGIN}&pass=${ADMIN_PASS}');
        document.getElementById('users').innerText = JSON.stringify(await resp.json(), null, 2);
      }
      async function getWithdraws(){
        const resp = await fetch('/admin/withdraws?login=${ADMIN_LOGIN}&pass=${ADMIN_PASS}');
        document.getElementById('withdraws').innerText = JSON.stringify(await resp.json(), null, 2);
      }
    </script>
  </body></html>`);
});

app.get('/admin/users', (req, res) => {
  if (req.query.login === ADMIN_LOGIN && req.query.pass === ADMIN_PASS) {
    res.json(users);
  } else res.json({ error: 'Access denied' });
});

app.get('/admin/withdraws', (req, res) => {
  if (req.query.login === ADMIN_LOGIN && req.query.pass === ADMIN_PASS) {
    res.json(withdrawRequests);
  } else res.json({ error: 'Access denied' });
});

// Основные API
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ success: false });
  if (!users[username]) users[username] = { balance: 10, totalDeposited: 0, totalWithdrawn: 0 };
  res.json({ success: true });
});

app.get('/getBalance', (req, res) => {
  const u = users[req.query.user];
  res.json({ balance: u ? u.balance : 0 });
});

app.post('/openCase', (req, res) => {
  const { user } = req.body;
  const u = users[user];
  if (!u) return res.json({ error: 'Пользователь не найден' });
  if (u.balance < 50) return res.json({ error: 'Недостаточно средств' });
  const rand = Math.random() * 100;
  let prize = rand < 70 ? 5 : rand < 90 ? 100 : rand < 98 ? 200 : 500;
  u.balance = u.balance - 50 + prize;
  res.json({ prize });
});

app.post('/withdraw', (req, res) => {
  const { user, amount, wallet } = req.body;
  const u = users[user];
  if (!u) return res.json({ message: 'Пользователь не найден' });
  if (amount > u.balance) return res.json({ message: 'Недостаточно средств' });
  if (amount < 50) return res.json({ message: 'Минимальная сумма 50₽' });
  withdrawRequests.push({ user, amount, wallet, date: new Date().toISOString() });
  u.balance -= amount;
  u.totalWithdrawn += amount;
  res.json({ message: `Заявка на ${amount}₽ принята. Ожидай до 24ч.` });
});

// Проверка USDT транзакций (каждые 30 сек)
async function checkPayments() {
  if (!USDT_ADDRESS || USDT_ADDRESS.includes('TFvfrf1NkM7iKxNkfuYJuMDEHQ8omXyifk')) return;
  try {
    const url = `https://api.trongrid.io/v1/accounts/${USDT_ADDRESS}/transactions/trc20?limit=10`;
    const resp = await fetch(url);
    const data = await resp.json();
    for (const tx of data.data) {
      if (tx.to === USDT_ADDRESS && tx.token_info.symbol === 'USDT') {
        const amount = tx.value / 1e6;
        let username = null;
        if (tx.raw_data && tx.raw_data.data) {
          try {
            username = Buffer.from(tx.raw_data.data, 'hex').toString('utf8').trim();
          } catch(e) {}
        }
        if (!username || username.length > 30) continue;
        const txId = tx.transaction_id;
        const lastTxKey = `last_tx_${username}`;
        if (!users[username]) users[username] = { balance: 0, totalDeposited: 0, totalWithdrawn: 0 };
        if (!users[username].lastTxId || users[username].lastTxId !== txId) {
          users[username].balance += amount * ROUBLES_PER_USDT;
          users[username].totalDeposited += amount * ROUBLES_PER_USDT;
          users[username].lastTxId = txId;
          console.log(`Зачислено ${amount} USDT (${amount * ROUBLES_PER_USDT}₽) пользователю ${username}`);
        }
      }
    }
  } catch (e) {
    console.error('Ошибка проверки USDT:', e.message);
  }
}
setInterval(checkPayments, 30000);
checkPayments();

// Отдача главной страницы
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('✅ Сайт готов на порту ' + listener.address().port);
});
