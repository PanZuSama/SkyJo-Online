import {
  initializeApp,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// Deine Konfiguration
const firebaseConfig = {
  apiKey: 'AIzaSyAvUfC6Dg1hv5fZSU7aupx7CG-JknFMe6w',
  authDomain: 'skyjo-dadf5.firebaseapp.com',
  projectId: 'skyjo-dadf5',
  storageBucket: 'skyjo-dadf5.firebasestorage.app',
  messagingSenderId: '844058719592',
  appId: '1:844058719592:web:bfae6c27890b696dbf12dd',
  measurementId: 'G-C420GD4ZD1',
};

// Firebase Initialisierung
const app = initializeApp (firebaseConfig);
const db = getDatabase (app);

// Globale Variablen
let players = [];
let currentPlayerIndex = 0;
let myPlayerIndex = 0;
let discardPile = [];
let drawPile = [];
let handCard = null;
let gameState = 'WAITING';
let roomPath = '';

const container = document.getElementById ('players-container');
const statusText = document.getElementById ('status');
const discardElement = document.getElementById ('discard-pile');
const handElement = document.getElementById ('current-hand');
const discardBtn = document.getElementById ('discard-btn');

/**
 * Betritt einen Raum oder erstellt ein neues Spiel
 */
window.joinGame = function () {
  const room = document.getElementById ('room-id').value;
  if (!room) return alert ('Bitte Raumnamen eingeben!');

  roomPath = 'rooms/' + room;
  myPlayerIndex = parseInt (document.getElementById ('my-position').value);

  // UI freischalten
  document.getElementById ('game-main').style.display = 'block';

  // Echtzeit-Überwachung des Raums
  onValue (ref (db, roomPath), snapshot => {
    const data = snapshot.val ();
    if (data) {
      players = data.players;
      currentPlayerIndex = data.currentPlayerIndex;
      discardPile = data.discardPile;
      drawPile = data.drawPile;
      handCard = data.handCard;
      gameState = data.gameState;
      render ();
      updateStatusLabel ();
    } else {
      // Raum existiert nicht -> Erstmaliges Setup durchführen
      initGame ();
    }
  });
};

/**
 * Initialisiert die Daten lokal und sendet sie an Firebase
 */
function initGame () {
  const numPlayers = parseInt (document.getElementById ('player-count').value);
  let newDrawPile = [];
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
      newDrawPile.push (item.v);
  });
  newDrawPile.sort (() => Math.random () - 0.5);

  let newPlayers = [];
  for (let p = 0; p < numPlayers; p++) {
    let b = [];
    for (let i = 0; i < 12; i++)
      b.push ({value: newDrawPile.pop (), open: false});
    newPlayers.push ({name: 'Spieler ' + (p + 1), board: b});
  }

  const initialData = {
    players: newPlayers,
    discardPile: [newDrawPile.pop ()],
    drawPile: newDrawPile,
    currentPlayerIndex: 0,
    handCard: null,
    gameState: 'START',
  };

  set (ref (db, roomPath), initialData);
}

/**
 * Aktualisiert Firebase nach jeder Aktion
 */
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

    const score = player.board.reduce ((s, c) => {
      if (gameState === 'FINISHED' || (c.open && c.value !== null)) {
        return s + (c.value || 0);
      }
      return s;
    }, 0);

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
        // Nur klicken wenn man selbst dran ist UND es das eigene Board ist
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

  // Button nur aktiv wenn man selbst dran ist
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
  } else {
    statusText.innerText = amIActive
      ? 'Du bist dran!'
      : `Warte auf ${players[currentPlayerIndex].name}...`;
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
    li.innerHTML = `<strong>#${index + 1} ${res.name}</strong>: ${res.score} Punkte`;
    list.appendChild (li);
  });

  document.getElementById ('overlay').style.display = 'block';
  document.getElementById ('end-screen').style.display = 'block';
  statusText.innerText = 'RUNDE BEENDET!';
}

window.closeEndScreen = function () {
  set (ref (db, roomPath), null); // Raum löschen für Neustart
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

window.joinGame = joinGame;
window.closeEndScreen = closeEndScreen;