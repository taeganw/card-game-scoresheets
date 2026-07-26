const STORAGE_KEY = "river-scoresheet-v1";

const state = {
  mode: "setup",
  playMode: "singles",
  deckSize: 52,
  maxCards: 13,
  missMode: "under-only",
  players: [
    { id: makeId(), name: "Mom", team: "A" },
    { id: makeId(), name: "Dad", team: "B" },
    { id: makeId(), name: "Taegan", team: "A" },
    { id: makeId(), name: "Guest", team: "B" }
  ],
  history: []
};

const els = {
  setupPanel: document.querySelector("#setup-panel"),
  gameShell: document.querySelector("#game-shell"),
  playerList: document.querySelector("#player-list"),
  playerTemplate: document.querySelector("#player-row-template"),
  playMode: document.querySelector("#play-mode"),
  deckSize: document.querySelector("#deck-size"),
  maxCards: document.querySelector("#max-cards"),
  missMode: document.querySelector("#miss-mode"),
  roundPreview: document.querySelector("#round-preview"),
  roundDirection: document.querySelector("#round-direction"),
  roundTitle: document.querySelector("#round-title"),
  trickTotal: document.querySelector("#trick-total"),
  roundEntry: document.querySelector("#round-entry"),
  entryMessage: document.querySelector("#entry-message"),
  scoreboard: document.querySelector("#scoreboard"),
  teamTotals: document.querySelector("#team-totals"),
  eventBanner: document.querySelector("#event-banner"),
  celebrationLayer: document.querySelector("#celebration-layer"),
  celebrationCard: document.querySelector("#celebration-card")
};

let celebrationTimer;
let bannerTimer;

load();
bind();
render();

function bind() {
  document.querySelector("#add-player").addEventListener("click", addPlayer);
  document.querySelector("#start-game").addEventListener("click", startGame);
  document.querySelector("#save-round").addEventListener("click", saveRound);
  document.querySelector("#undo-round").addEventListener("click", undoRound);
  document.querySelector("#edit-setup").addEventListener("click", showSetup);
  document.querySelector("#reset-game").addEventListener("click", resetGame);
  document.querySelector("#new-game-top").addEventListener("click", resetGame);

  [els.playMode, els.deckSize, els.maxCards, els.missMode].forEach((input) => {
    input.addEventListener("input", () => {
      state.playMode = els.playMode.value;
      state.deckSize = numberValue(els.deckSize, 52);
      state.maxCards = numberValue(els.maxCards, suggestedMaxCards());
      state.missMode = els.missMode.value;
      save();
      render();
    });
  });
}

function addPlayer() {
  state.players.push({
    id: makeId(),
    name: `Player ${state.players.length + 1}`,
    team: state.players.length % 2 === 0 ? "A" : "B"
  });
  state.maxCards = suggestedMaxCards();
  save();
  render();
}

function startGame() {
  syncPlayersFromDom();
  if (state.players.length < 2) {
    els.entryMessage.textContent = "Add at least two players.";
    return;
  }
  state.mode = "game";
  state.history = [];
  state.maxCards = clamp(numberValue(els.maxCards, suggestedMaxCards()), 1, 26);
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSetup() {
  syncRoundEntries();
  state.mode = "setup";
  save();
  render();
}

function resetGame() {
  if (!confirm("Clear this scoresheet and start over?")) return;
  state.mode = "setup";
  state.history = [];
  save();
  render();
}

function undoRound() {
  state.history.pop();
  save();
  render();
}

function saveRound() {
  const round = currentRound();
  const rows = [...els.roundEntry.querySelectorAll(".entry-row")].map((row) => {
    const playerId = row.dataset.playerId;
    const board = row.querySelector(".board-input").checked;
    const bidInput = row.querySelector(".bid-input");
    const tricksInput = row.querySelector(".tricks-input");
    const bid = board ? round.cards : numberValue(bidInput, 0);
    const tricks = numberValue(tricksInput, 0);
    return { playerId, bid, tricks, board, delta: scoreRound({ bid, tricks, board }) };
  });

  const totalTricks = rows.reduce((sum, row) => sum + row.tricks, 0);
  if (totalTricks !== round.cards) {
    els.entryMessage.textContent = `Tricks must total ${round.cards}. Current total is ${totalTricks}.`;
    return;
  }

  const previousScores = currentScores();
  state.history.push({ cards: round.cards, direction: round.direction, entries: rows });
  const nextRound = currentRound();
  const event = buildRoundEvent(rows, previousScores, nextRound.finished);
  save();
  render();
  showRoundEvent(event);
}

function scoreRound(entry) {
  if (entry.board) {
    return entry.tricks === entry.bid ? 5 * entry.tricks : -3 * entry.bid;
  }
  if (entry.tricks === entry.bid) return 3 * entry.tricks;
  if (state.missMode === "zero") return 0;
  if (state.missMode === "any-miss") return -3 * entry.bid;
  return entry.tricks < entry.bid ? -3 * entry.bid : 0;
}

function render() {
  els.playMode.value = state.playMode;
  els.deckSize.value = state.deckSize;
  els.maxCards.value = state.maxCards;
  els.missMode.value = state.missMode;
  els.roundPreview.textContent = `1 to ${state.maxCards} to 1`;
  els.setupPanel.classList.toggle("hidden", state.mode !== "setup");
  els.gameShell.classList.toggle("hidden", state.mode !== "game");
  renderPlayers();
  renderGame();
  save();
}

function renderPlayers() {
  els.playerList.classList.toggle("teams", state.playMode === "teams");
  els.playerList.innerHTML = "";
  state.players.forEach((player) => {
    const row = els.playerTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.playerId = player.id;
    row.querySelector(".player-name").value = player.name;
    row.querySelector(".team-select").value = player.team;
    row.querySelector(".player-name").addEventListener("input", syncPlayersFromDom);
    row.querySelector(".team-select").addEventListener("change", syncPlayersFromDom);
    row.querySelector(".remove-player").addEventListener("click", () => {
      state.players = state.players.filter((candidate) => candidate.id !== player.id);
      state.maxCards = suggestedMaxCards();
      save();
      render();
    });
    els.playerList.append(row);
  });
}

function renderGame() {
  if (state.mode !== "game") return;
  const round = currentRound();
  els.roundDirection.textContent = round.direction === "up" ? "Up river" : "Down river";
  els.roundTitle.textContent = round.finished ? "Game complete" : `Round ${state.history.length + 1}: ${round.cards} card${round.cards === 1 ? "" : "s"}`;
  renderRoundEntry(round);
  renderTeamTotals();
  renderScoreboard();
}

function renderRoundEntry(round) {
  els.roundEntry.innerHTML = "";
  if (round.finished) {
    els.entryMessage.textContent = "Final scores are in.";
    document.querySelector("#save-round").disabled = true;
    return;
  }
  document.querySelector("#save-round").disabled = false;

  state.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "entry-row";
    row.dataset.playerId = player.id;
    row.innerHTML = `
      <div class="entry-name">${escapeHtml(player.name)}</div>
      <label class="mini-field">Bid <input class="bid-input" type="number" min="0" max="${round.cards}" step="1" value="0"></label>
      <label class="mini-field">Took <input class="tricks-input" type="number" min="0" max="${round.cards}" step="1" value="0"></label>
      <label class="board-toggle">Board <input class="board-input" type="checkbox"></label>
    `;
    row.querySelector(".board-input").addEventListener("change", (event) => {
      row.querySelector(".bid-input").value = event.target.checked ? round.cards : row.querySelector(".bid-input").value;
      row.classList.toggle("board-armed", event.target.checked);
      updateTrickTotal(round);
    });
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => updateTrickTotal(round)));
    els.roundEntry.append(row);
  });
  updateTrickTotal(round);
}

function renderTeamTotals() {
  els.teamTotals.innerHTML = "";
  els.teamTotals.classList.toggle("hidden", state.playMode !== "teams");
  if (state.playMode !== "teams") return;

  const scores = currentScores();
  ["A", "B"].forEach((team) => {
    const total = state.players
      .filter((player) => player.team === team)
      .reduce((sum, player) => sum + scores[player.id], 0);
    const card = document.createElement("div");
    card.className = "team-total";
    card.innerHTML = `<span>Team ${team}</span><strong>${total}</strong>`;
    els.teamTotals.append(card);
  });
}

function renderScoreboard() {
  const scores = currentScores();
  const leaders = [...state.players].sort((a, b) => scores[b.id] - scores[a.id]);
  const head = `<thead><tr><th>Round</th>${leaders.map((p) => `<th>${escapeHtml(p.name)}</th>`).join("")}</tr></thead>`;
  const bodyRows = state.history.map((round, index) => {
    const entriesByPlayer = Object.fromEntries(round.entries.map((entry) => [entry.playerId, entry]));
    return `<tr><td>${index + 1}. ${round.cards}</td>${leaders.map((player) => {
      const entry = entriesByPlayer[player.id];
      const label = entry.board ? "board" : `bid ${entry.bid}`;
      return `<td>${entry.delta > 0 ? "+" : ""}${entry.delta}<span class="score-delta">${label}, took ${entry.tricks}</span></td>`;
    }).join("")}</tr>`;
  }).join("");
  const foot = `<tfoot><tr><th>Total</th>${leaders.map((player) => `<td>${scores[player.id]}</td>`).join("")}</tr></tfoot>`;
  els.scoreboard.innerHTML = `${head}<tbody>${bodyRows || `<tr><td colspan="${leaders.length + 1}">No rounds scored yet.</td></tr>`}</tbody>${foot}`;
}

function buildRoundEvent(rows, previousScores, finished) {
  const boardEntries = rows
    .filter((entry) => entry.board)
    .map((entry) => ({ ...entry, player: state.players.find((player) => player.id === entry.playerId) }))
    .filter((entry) => entry.player);

  const madeBoards = boardEntries.filter((entry) => entry.delta > 0);
  const missedBoards = boardEntries.filter((entry) => entry.delta < 0);

  if (finished) {
    const scores = currentScores();
    const best = Math.max(...Object.values(scores));
    const winners = state.players.filter((player) => scores[player.id] === best);
    const leaderChanged = winners.some((player) => scores[player.id] > (previousScores[player.id] || 0));
    return {
      type: "win",
      title: winners.length === 1 ? `${winners[0].name} wins` : `${winners.map((player) => player.name).join(" and ")} tie`,
      detail: `Final score: ${best}`,
      confetti: true,
      banner: leaderChanged ? "Final round shook up the table." : "Final scores are in."
    };
  }

  if (madeBoards.length) {
    const names = madeBoards.map((entry) => entry.player.name).join(" and ");
    return {
      type: "board",
      title: `${names} made board`,
      detail: `+${madeBoards.reduce((sum, entry) => sum + entry.delta, 0)} board points`,
      confetti: true,
      banner: `${names} called board and got it.`
    };
  }

  if (missedBoards.length) {
    const names = missedBoards.map((entry) => entry.player.name).join(" and ");
    return {
      type: "miss",
      title: `${names} missed board`,
      detail: `${missedBoards.reduce((sum, entry) => sum + entry.delta, 0)} points`,
      confetti: false,
      banner: `${names} called board and missed.`
    };
  }

  const biggestGain = rows.reduce((best, entry) => entry.delta > best.delta ? entry : best, rows[0]);
  const player = state.players.find((candidate) => candidate.id === biggestGain.playerId);
  return {
    type: "plain",
    banner: player && biggestGain.delta > 0 ? `${player.name} led the round with +${biggestGain.delta}.` : "Round saved."
  };
}

function showRoundEvent(event) {
  if (!event) return;
  showBanner(event.banner, event.type);
  if (event.type === "plain") return;
  showCelebration(event);
}

function showBanner(message, type) {
  window.clearTimeout(bannerTimer);
  els.eventBanner.textContent = message;
  els.eventBanner.className = `event-banner ${type === "miss" ? "miss" : ""} ${type === "win" ? "win" : ""}`;
  bannerTimer = window.setTimeout(() => els.eventBanner.classList.add("hidden"), 4200);
}

function showCelebration(event) {
  window.clearTimeout(celebrationTimer);
  els.celebrationLayer.classList.remove("hidden");
  els.celebrationLayer.querySelectorAll(".confetti-piece, .splash-piece").forEach((piece) => piece.remove());
  els.celebrationCard.className = `celebration-card ${event.type === "miss" ? "miss" : ""} ${event.type === "win" ? "win" : ""}`;
  els.celebrationCard.innerHTML = `
    <div class="celebration-kicker">${event.type === "miss" ? "Board busted" : event.type === "win" ? "Game winner" : "Board made"}</div>
    <div class="celebration-title">${escapeHtml(event.title)}</div>
    <div class="celebration-detail">${escapeHtml(event.detail)}</div>
  `;

  if (event.confetti) {
    launchConfetti(event.type === "win" ? 70 : 38);
  } else {
    launchSplash();
  }

  celebrationTimer = window.setTimeout(() => {
    els.celebrationLayer.classList.add("hidden");
  }, event.type === "win" ? 3200 : 2300);
}

function launchConfetti(count) {
  const colors = ["#1f7a6b", "#c7842a", "#4078bc", "#b64435", "#f4eadc"];
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--drift", `${Math.random() * 140 - 70}px`);
    piece.style.setProperty("--spin", `${Math.random() * 720 + 180}deg`);
    piece.style.setProperty("--fall-time", `${Math.random() * 900 + 1100}ms`);
    piece.style.animationDelay = `${Math.random() * 220}ms`;
    els.celebrationLayer.append(piece);
  }
}

function launchSplash() {
  for (let index = 0; index < 20; index += 1) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 20;
    const distance = 90 + Math.random() * 120;
    piece.className = "splash-piece";
    piece.style.left = "50%";
    piece.style.top = "48%";
    piece.style.background = index % 2 ? "#b64435" : "#211d18";
    piece.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    els.celebrationLayer.append(piece);
  }
}

function currentRound() {
  const sequence = roundSequence();
  const next = sequence[state.history.length];
  if (!next) return { finished: true, cards: 0, direction: "down" };
  return { finished: false, cards: next, direction: state.history.length < state.maxCards ? "up" : "down" };
}

function roundSequence() {
  const up = Array.from({ length: state.maxCards }, (_, index) => index + 1);
  const down = Array.from({ length: state.maxCards }, (_, index) => state.maxCards - index);
  return [...up, ...down];
}

function currentScores() {
  const totals = Object.fromEntries(state.players.map((player) => [player.id, 0]));
  state.history.forEach((round) => {
    round.entries.forEach((entry) => {
      totals[entry.playerId] = (totals[entry.playerId] || 0) + entry.delta;
    });
  });
  return totals;
}

function updateTrickTotal(round) {
  const total = [...els.roundEntry.querySelectorAll(".tricks-input")].reduce((sum, input) => sum + numberValue(input, 0), 0);
  els.trickTotal.textContent = `${total} / ${round.cards} tricks`;
  els.trickTotal.style.borderColor = total === round.cards ? "rgba(31, 122, 107, 0.24)" : "rgba(182, 68, 53, 0.45)";
  els.entryMessage.textContent = total === round.cards ? "Ready to save this round." : "Tricks taken should match the cards in this round.";
}

function syncPlayersFromDom() {
  state.players = [...els.playerList.querySelectorAll(".player-row")].map((row, index) => ({
    id: row.dataset.playerId,
    name: row.querySelector(".player-name").value.trim() || `Player ${index + 1}`,
    team: row.querySelector(".team-select").value
  }));
  state.maxCards = clamp(state.maxCards, 1, suggestedMaxCards());
  save();
}

function syncRoundEntries() {
  if (state.mode === "game") save();
}

function suggestedMaxCards() {
  return clamp(Math.floor(state.deckSize / Math.max(state.players.length, 1)), 1, 26);
}

function numberValue(input, fallback) {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    Object.assign(state, saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
