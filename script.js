import {
  initializeApp,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
  get,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// Firebase Konfiguration
const firebaseConfig = {
  apiKey: 'AIzaSyAvUfC6Dg1hv5fZSU7aupx7CG-JknFMe6w',
  authDomain: 'skyjo-dadf5.firebaseapp.com',
  projectId: 'skyjo-dadf5',
  storageBucket: 'skyjo-dadf5.firebasestorage.app',
  messagingSenderId: '844058719592',
  appId: '1:844058719592:web:bfae6c27890b696dbf12dd',
  measurementId: 'G-C420GD4ZD1',
};

const app = initializeApp (firebaseConfig);
const db = getDatabase (app);

// Globale Variablen
let players = [];
let currentPlayerIndex = 0;
let myPlayerIndex = -1;
let discardPile = [];
let drawPile = [];
let handCard = null;
let gameState = 'WAITING';
let roomPath = '';
let myName = '';

const container = document.getElementById ('players-container');
const statusText = document.getElementById ('status');
const discardElement = document.getElementById ('discard-pile');
const handElement = document.getElementById ('current-hand');
const discardBtn = document.getElementById ('discard-btn');

// BEIM LADEN: Prüfen ob ein Raum-Link genutzt wurde
window.onload = () => {
  const urlParams = new URLSearchParams (window.location.search);
  const roomFromUrl = urlParams.get ('room');
  if (roomFromUrl) {
    document.getElementById ('room-id').value = roomFromUrl;
    document.getElementById ('create-room-area').style.display = 'none';
    statusText.innerText = 'Raum aus Link erkannt. Gib deinen Namen ein!';
  }
};

/**
 * Phase 1: Namen bestätigen
 */
window.showRoomSetup = function () {
  myName = document.getElementById ('player-name-input').value.trim ();
  if (!myName) return alert ('Bitte gib einen Namen ein!');

  document.getElementById ('login-screen').style.display = 'none';
  document.getElementById ('room-setup').style.display = 'block';
  statusText.innerText = 'Wähle einen Raumnamen oder erstelle einen.';
};

/**
 * Phase 2: Raum erstellen oder beitreten (Auto-Positionierung)
 */
window.createAndJoin = async function () {
  const room = document.getElementById ('room-id').value.trim ();
  if (!room) return alert ('Bitte Raumnamen eingeben!');

  roomPath = 'rooms/' + room;
  const roomRef = ref (db, roomPath);

  // Prüfen ob Raum existiert
  const snapshot = await get (roomRef);

  if (!snapshot.exists ()) {
    // ICH BIN DER HOST (Position 0)
    myPlayerIndex = 0;
    await initGame (room);
  } else {
    // ICH BIN EIN GAST -> Nächsten freien Platz suchen
    const data = snapshot.val ();
    players = data.players;

    // Suche Platz, der noch "Spieler X" heißt (Platzhalter aus initGame)
    myPlayerIndex = players.findIndex (p => p.name.startsWith ('Spieler '));

    if (myPlayerIndex === -1) return alert ('Raum ist leider voll!');

    players[myPlayerIndex].name = myName;
    await update (roomRef, {players: players});
  }

  // Einladungs-Link anzeigen
  const shareUrl =
    window.location.origin + window.location.pathname + '?room=' + room;
  document.getElementById ('share-link').value = shareUrl;
  document.getElementById ('share-area').style.display = 'block';
  document.getElementById ('create-room-area').style.display = 'none';

  // Echtzeit-Überwachung starten
  onValue (roomRef, snap => {
    const data = snap.val ();
    if (data) {
      players = data.players;
      currentPlayerIndex = data.currentPlayerIndex;
      discardPile = data.discardPile;
      drawPile = data.drawPile;
      handCard = data.handCard;
      gameState = data.gameState;

      if (gameState === 'WAITING') {
        updateLobbyUI ();
      } else {
        document.getElementById ('room-setup').style.display = 'none';
        document.getElementById ('game-main').style.display = 'block';
        render ();
        updateStatusLabel ();
      }
    }
  });
};

function updateLobbyUI () {
  const joinedCount = players.filter (p => !p.name.startsWith ('Spieler '))
    .length;
  const waitMsg = document.getElementById ('player-wait-status');
  const hostArea = document.getElementById ('host-action-area');

  waitMsg.innerText = `Bereit: ${joinedCount} Spieler im Raum.`;

  if (myPlayerIndex === 0) {
    hostArea.innerHTML = joinedCount >= 2
      ? `<button onclick="startGameNow()" style="background: #27ae60;">Spiel für alle starten!</button>`
      : `<p>Warte auf mindestens einen weiteren Mitspieler...</p>`;
  } else {
    hostArea.innerHTML = `<p>Warte darauf, dass der Host das Spiel startet...</p>`;
  }
}

window.startGameNow = function () {
  update (ref (db, roomPath), {gameState: 'START'});
};

/**
 * Initialisiert das Deck und die Platzhalter-Spieler
 */
async function initGame (roomName) {
  const maxPlayers = parseInt (document.getElementById ('player-count').value);
  let deck = [];
  const dist = [
    {v: -2, c: 5},
    {v: -1, c: 10},
    {v: 0, c: 15},
    {v: 1, c: 10},
    {v: 2, c: 10},
    {v: 3, c: 10},
    {v: 4, c: 10},
    {v: 5, c: 10},
    {v: 6, c: 10},
    {v: 7, c: 10},
    {v: 8, c: 10},
    {v: 9, c: 10},
    {v: 10, c: 10},
    {v: 11, c: 10},
    {v: 12, c: 10},
  ];
  dist.forEach (item => {
    for (let i = 0; i < item.c; i++)
      deck.push (item.v);
  });
  deck.sort (() => Math.random () - 0.5);

  let newPlayers = [];
  for (let p = 0; p < maxPlayers; p++) {
    let b = [];
    for (let i = 0; i < 12; i++)
      b.push ({value: deck.pop (), open: false});
    // Nur Host hat schon seinen echten Namen
    let pName = p === 0 ? myName : `Spieler ${p + 1}`;
    newPlayers.push ({name: pName, board: b});
  }

  const initialData = {
    players: newPlayers,
    discardPile: [deck.pop ()],
    drawPile: deck,
    currentPlayerIndex: 0,
    handCard: null,
    gameState: 'WAITING',
  };

  await set (ref (db, roomPath), initialData);
}

function sync () {
  if (!roomPath) return;
  update (ref (db, roomPath), {
    players,
    currentPlayerIndex,
    discardPile,
    drawPile,
    handCard,
    gameState,
  });
}

function render () {
  container.innerHTML = '';
  players.forEach ((player, pIdx) => {
    const pDiv = document.createElement ('div');
    const isMe = pIdx === myPlayerIndex;
    pDiv.className = `player-area ${pIdx === currentPlayerIndex ? 'active' : ''} ${isMe ? 'is-me' : ''}`;

    const score = player.board.reduce (
      (s, c) => (c.open && c.value !== null ? s + c.value : s),
      0
    );
    pDiv.innerHTML = `<h3>${player.name} ${isMe ? '(Du)' : ''} (${score} Pkt)</h3>`;

    const grid = document.createElement ('div');
    grid.className = 'grid-container';
    player.board.forEach ((card, cIdx) => {
      const cDiv = document.createElement ('div');
      cDiv.className = `card ${!card.open ? 'back' : ''}`;
      if (card.value === null) cDiv.classList.add ('hidden');
      if (card.open && card.value !== null) {
        cDiv.innerText = card.value;
        applyColor (cDiv, card.value);
      }
      cDiv.onclick = () => {
        if (pIdx === currentPlayerIndex && pIdx === myPlayerIndex)
          handleBoardClick (cIdx);
      };
      grid.appendChild (cDiv);
    });
    pDiv.appendChild (grid);
    container.appendChild (pDiv);
  });

  const ld = discardPile[discardPile.length - 1];
  discardElement.innerText = ld;
  applyColor (discardElement, ld);

  handElement.innerText = handCard !== null ? handCard : '';
  handElement.className = `card ${handCard === null ? 'empty' : ''}`;
  if (handCard !== null) applyColor (handElement, handCard);

  discardBtn.disabled = !(gameState === 'ACTION' &&
    handCard !== null &&
    currentPlayerIndex === myPlayerIndex);
}

function handleBoardClick (idx) {
  if (gameState === 'FINISHED') return;
  let p = players[currentPlayerIndex];
  let c = p.board[idx];

  if (gameState === 'START' && !c.open) {
    c.open = true;
    if (p.board.filter (k => k.open).length >= 2) {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      if (currentPlayerIndex === 0) gameState = 'DRAW';
    }
  } else if (gameState === 'ACTION' && handCard !== null) {
    discardPile.push (c.value);
    c.value = handCard;
    c.open = true;
    handCard = null;
    checkCols (p.board);
    nextTurn ();
  } else if (gameState === 'FORCE_REVEAL' && !c.open) {
    c.open = true;
    checkCols (p.board);
    nextTurn ();
  }
  sync ();
}

function nextTurn () {
  const isFinished = players[currentPlayerIndex].board.every (
    k => k.open || k.value === null
  );
  if (isFinished) {
    gameState = 'FINISHED';
    players.forEach (p => p.board.forEach (card => (card.open = true)));
    sync ();
    return;
  }
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  gameState = 'DRAW';
}

function updateStatusLabel () {
  if (gameState === 'FINISHED') {
    showFinalResults ();
    return;
  }
  const amIActive = currentPlayerIndex === myPlayerIndex;
  if (gameState === 'START') {
    statusText.innerText = amIActive
      ? 'Du: Decke 2 Karten auf!'
      : `${players[currentPlayerIndex].name} deckt auf...`;
  } else if (gameState === 'DRAW') {
    statusText.innerText = amIActive
      ? 'Zieh eine Karte!'
      : `Warte auf ${players[currentPlayerIndex].name}...`;
  } else if (gameState === 'ACTION') {
    statusText.innerText = amIActive
      ? 'Karte tauschen oder abwerfen?'
      : `${players[currentPlayerIndex].name} am Zug...`;
  } else if (gameState === 'FORCE_REVEAL') {
    statusText.innerText = amIActive
      ? 'Decke eine Karte auf!'
      : `${players[currentPlayerIndex].name} deckt auf...`;
  }
}

function showFinalResults () {
  const results = players
    .map (p => {
      const finalScore = p.board.reduce ((s, c) => s + (c.value || 0), 0);
      return {name: p.name, score: finalScore};
    })
    .sort ((a, b) => a.score - b.score);

  const list = document.getElementById ('leaderboard');
  list.innerHTML = '';
  results.forEach ((res, index) => {
    const li = document.createElement ('li');
    li.innerHTML = `<span>#${index + 1} ${res.name}</span> <span>${res.score} Pkt</span>`;
    list.appendChild (li);
  });

  document.getElementById ('overlay').style.display = 'block';
  document.getElementById ('end-screen').style.display = 'block';
}

window.closeEndScreen = function () {
  set (ref (db, roomPath), null);
  location.reload ();
};

function applyColor (el, v) {
  el.classList.remove ('val-neg', 'val-zero', 'val-high', 'val-low');
  if (v < 0) el.classList.add ('val-neg');
  else if (v === 0) el.classList.add ('val-zero');
  else if (v > 4) el.classList.add ('val-high');
  else el.classList.add ('val-low');
}

function checkCols (b) {
  for (let col = 0; col < 4; col++) {
    let i = [col, col + 4, col + 8];
    let v = i.map (idx => b[idx]);
    if (
      v.every (
        card => card.open && card.value !== null && card.value === v[0].value
      )
    ) {
      i.forEach (idx => (b[idx].value = null));
    }
  }
}

document.getElementById ('draw-pile').onclick = () => {
  if (gameState === 'DRAW' && currentPlayerIndex === myPlayerIndex) {
    handCard = drawPile.pop ();
    gameState = 'ACTION';
    sync ();
  }
};

discardElement.onclick = () => {
  if (gameState === 'DRAW' && currentPlayerIndex === myPlayerIndex) {
    handCard = discardPile.pop ();
    gameState = 'ACTION';
    sync ();
  }
};

discardBtn.onclick = () => {
  if (
    gameState === 'ACTION' &&
    handCard !== null &&
    currentPlayerIndex === myPlayerIndex
  ) {
    discardPile.push (handCard);
    handCard = null;
    gameState = 'FORCE_REVEAL';
    sync ();
  }
};

// Global zugänglich machen
window.joinGame = createAndJoin;
window.showRoomSetup = showRoomSetup;
window.startGameNow = startGameNow;
window.closeEndScreen = closeEndScreen;
