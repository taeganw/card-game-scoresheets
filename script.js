const STORAGE_KEY = "river-scoresheet-v1";
const GAME_CATEGORIES = {
  drinking: {
    title: "Drinking Games",
    games: [
      { id: "coming-drinking", name: "Drinking games", description: "Penalty presets and party modes are coming soon.", enabled: false }
    ]
  },
  card: {
    title: "Card Games",
    games: [
      { id: "river", name: "Up the River, Down the River", description: "Bid, board, track tricks, rotate dealer, and keep score.", enabled: true }
    ]
  },
  party: {
    title: "Party Games",
    games: [
      { id: "coming-party", name: "Party games", description: "Prompt and group-vote games are coming soon.", enabled: false }
    ]
  }
};

const state = {
  mode: "home",
  selectedCategory: "",
  selectedGame: "",
  activeTab: "score",
  setupTab: "rules",
  playMode: "singles",
  deckSize: 52,
  maxCards: 17,
  boardPoints: 5,
  boardMissPoints: 5,
  hitPoints: 3,
  underPoints: 3,
  startingDealerId: "",
  players: createDefaultPlayers(),
  history: []
};

const els = {
  homePanel: document.querySelector("#home-panel"),
  categoryGrid: document.querySelector("#category-grid"),
  categoryButtons: [...document.querySelectorAll(".category-card")],
  gamePicker: document.querySelector("#game-picker"),
  gamePickerTitle: document.querySelector("#game-picker-title"),
  gameGrid: document.querySelector("#game-grid"),
  setupPanel: document.querySelector("#setup-panel"),
  setupTabs: [...document.querySelectorAll(".setup-tab")],
  setupPanels: [...document.querySelectorAll(".setup-panel-page")],
  gameShell: document.querySelector("#game-shell"),
  gameTabs: [...document.querySelectorAll(".game-tab")],
  gamePanels: [...document.querySelectorAll(".game-panel")],
  playerList: document.querySelector("#player-list"),
  playerTemplate: document.querySelector("#player-row-template"),
  playMode: document.querySelector("#play-mode"),
  deckSize: document.querySelector("#deck-size"),
  maxCards: document.querySelector("#max-cards"),
  boardPoints: document.querySelector("#board-points"),
  boardMissPoints: document.querySelector("#board-miss-points"),
  hitPoints: document.querySelector("#hit-points"),
  underPoints: document.querySelector("#under-points"),
  roundPreview: document.querySelector("#round-preview"),
  boardRule: document.querySelector("#board-rule"),
  boardMissRule: document.querySelector("#board-miss-rule"),
  hitRule: document.querySelector("#hit-rule"),
  underRule: document.querySelector("#under-rule"),
  overRule: document.querySelector("#over-rule"),
  roundDirection: document.querySelector("#round-direction"),
  roundTitle: document.querySelector("#round-title"),
  dealerLine: document.querySelector("#dealer-line"),
  trickTotal: document.querySelector("#trick-total"),
  roundEntry: document.querySelector("#round-entry"),
  entryMessage: document.querySelector("#entry-message"),
  scoreboard: document.querySelector("#scoreboard"),
  teamTotals: document.querySelector("#team-totals"),
  standingsList: document.querySelector("#standings-list"),
  bidStats: document.querySelector("#bid-stats"),
  startGameButton: document.querySelector("#start-game"),
  eventBanner: document.querySelector("#event-banner"),
  celebrationLayer: document.querySelector("#celebration-layer"),
  celebrationCard: document.querySelector("#celebration-card"),
  wakeLockButton: document.querySelector("#wake-lock")
};

const sounds = typeof Audio === "function"
  ? {
      board: new Audio("assets/sounds/board-made.wav"),
      miss: new Audio("assets/sounds/board-missed.wav")
    }
  : {};

let celebrationTimer;
let bannerTimer;
let wakeLockSentinel;
let wakeLockRequested = false;

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
  document.querySelector("#new-game-top").addEventListener("click", goHome);
  els.wakeLockButton.addEventListener("click", toggleWakeLock);
  document.addEventListener("visibilitychange", restoreWakeLock);
  els.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => selectCategory(button.dataset.category));
  });
  els.gameTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });
  els.setupTabs.forEach((button) => {
    button.addEventListener("click", () => setSetupTab(button.dataset.setupTab));
  });

  els.playMode.addEventListener("change", () => {
    syncSettingsFromDom({ clampRounds: false });
    render();
  });

  [els.deckSize, els.maxCards, els.boardPoints, els.boardMissPoints, els.hitPoints, els.underPoints].forEach((input) => {
    input.addEventListener("input", () => syncSettingsFromDom({ clampRounds: false }));
  });

  [els.deckSize, els.maxCards, els.boardPoints, els.boardMissPoints, els.hitPoints, els.underPoints].forEach((input) => {
    input.addEventListener("change", commitNumericSettings);
    input.addEventListener("blur", commitNumericSettings);
  });
}

function addPlayer() {
  state.players.push({
    id: makeId(),
    name: "",
    team: state.players.length % 2 === 0 ? "A" : "B"
  });
  state.maxCards = maxPossibleCards();
  save();
  render();
}

function startGame() {
  const existingRoundCount = state.history.length;
  syncPlayersFromDom();
  syncSettingsFromDom({ clampRounds: true });
  if (state.players.length < 2) {
    els.entryMessage.textContent = "Add at least two players.";
    return;
  }
  if (!existingRoundCount) {
    ensureStartingDealer();
    state.history = [];
  } else if (!state.players.some((player) => player.id === state.startingDealerId)) {
    ensureStartingDealer();
  }
  state.mode = "game";
  state.activeTab = "score";
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectCategory(category) {
  state.selectedCategory = category;
  save();
  renderHome();
}

function selectGame(gameId) {
  if (gameId !== "river") return;
  state.selectedGame = gameId;
  state.selectedCategory = "card";
  state.mode = "setup";
  state.setupTab = "rules";
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goHome() {
  if (state.history.length && !confirm("Leave this scoresheet and return home?")) return;
  state.mode = "home";
  state.selectedCategory = "";
  state.selectedGame = "";
  state.activeTab = "score";
  state.history = [];
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSetup() {
  syncRoundEntries();
  state.mode = "setup";
  state.setupTab = "rules";
  save();
  render();
}

function resetGame() {
  if (!confirm("Clear this scoresheet and start over?")) return;
  state.mode = "setup";
  state.activeTab = "score";
  state.setupTab = "rules";
  state.history = [];
  state.players = createDefaultPlayers();
  state.startingDealerId = "";
  state.maxCards = maxPossibleCards();
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
    return entry.tricks === entry.bid ? state.boardPoints * entry.tricks : -state.boardMissPoints * entry.bid;
  }
  if (entry.tricks === entry.bid) return state.hitPoints * entry.tricks;
  if (entry.tricks < entry.bid) return -state.underPoints * entry.bid;
  return entry.tricks;
}

function render() {
  document.body.classList.toggle("app-locked", ["home", "setup", "game"].includes(state.mode));
  document.body.classList.toggle("game-active", state.mode === "game");
  els.playMode.value = state.playMode;
  els.deckSize.value = state.deckSize;
  els.maxCards.value = state.maxCards;
  els.maxCards.max = maxPossibleCards();
  els.boardPoints.value = state.boardPoints;
  els.boardMissPoints.value = state.boardMissPoints;
  els.hitPoints.value = state.hitPoints;
  els.underPoints.value = state.underPoints;
  els.roundPreview.textContent = `1 to ${state.maxCards} to 1`;
  els.startGameButton.textContent = state.history.length ? "Save settings" : "Start scoring";
  renderScoringRules();
  els.homePanel.classList.toggle("hidden", state.mode !== "home");
  els.setupPanel.classList.toggle("hidden", state.mode !== "setup");
  els.gameShell.classList.toggle("hidden", state.mode !== "game");
  renderHome();
  renderPlayers();
  renderSetupTabs();
  renderGameTabs();
  renderGame();
  save();
}

function setSetupTab(tab) {
  state.setupTab = ["rules", "players"].includes(tab) ? tab : "rules";
  save();
  renderSetupTabs();
}

function renderSetupTabs() {
  const setupTab = ["rules", "players"].includes(state.setupTab) ? state.setupTab : "rules";
  state.setupTab = setupTab;
  els.setupTabs.forEach((button) => {
    const isActive = button.dataset.setupTab === setupTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  els.setupPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.setupPanel === setupTab);
  });
}

function renderHome() {
  els.categoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.selectedCategory);
  });

  const category = GAME_CATEGORIES[state.selectedCategory];
  els.gamePicker.classList.toggle("hidden", !category);
  if (!category) {
    els.gameGrid.innerHTML = "";
    return;
  }

  els.gamePickerTitle.textContent = category.title;
  els.gameGrid.innerHTML = category.games.map((game) => `
    <button class="game-card ${game.enabled ? "" : "disabled"}" type="button" data-game="${escapeHtml(game.id)}" ${game.enabled ? "" : "disabled"}>
      <strong>${escapeHtml(game.name)}</strong>
      <span>${escapeHtml(game.description)}</span>
    </button>
  `).join("");

  [...els.gameGrid.querySelectorAll(".game-card")].forEach((button) => {
    button.addEventListener("click", () => selectGame(button.dataset.game));
  });
}

function renderPlayers() {
  els.playerList.classList.toggle("teams", state.playMode === "teams");
  els.playerList.innerHTML = "";
  state.players.forEach((player) => {
    const row = els.playerTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.playerId = player.id;
    const index = state.players.indexOf(player);
    row.querySelector(".player-name").value = player.name;
    row.querySelector(".player-name").placeholder = `Player ${index + 1}`;
    row.querySelector(".team-select").value = player.team;
    row.querySelector(".dealer-input").checked = player.id === state.startingDealerId;
    row.querySelector(".player-name").addEventListener("input", syncPlayersFromDom);
    row.querySelector(".team-select").addEventListener("change", syncPlayersFromDom);
    row.querySelector(".dealer-input").addEventListener("change", () => {
      state.startingDealerId = player.id;
      save();
      render();
    });
    row.querySelector(".remove-player").addEventListener("click", () => {
      state.players = state.players.filter((candidate) => candidate.id !== player.id);
      if (state.startingDealerId === player.id) state.startingDealerId = "";
      state.maxCards = maxPossibleCards();
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
  renderDealerLine();
  renderRoundEntry(round);
  renderTeamTotals();
  renderStandingsList();
  renderBidStats();
  renderScoreboard();
}

function setActiveTab(tab) {
  state.activeTab = ["score", "table", "stats", "rounds"].includes(tab) ? tab : "score";
  save();
  renderGameTabs();
}

function renderGameTabs() {
  const activeTab = ["score", "table", "stats", "rounds"].includes(state.activeTab) ? state.activeTab : "score";
  state.activeTab = activeTab;
  els.gameTabs.forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  els.gamePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === activeTab);
  });
}

function renderRoundEntry(round) {
  els.roundEntry.innerHTML = "";
  if (round.finished) {
    els.entryMessage.textContent = "Final scores are in.";
    document.querySelector("#save-round").disabled = true;
    return;
  }
  document.querySelector("#save-round").disabled = false;

  state.players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "entry-row";
    row.dataset.playerId = player.id;
    if (player.id === currentDealerId()) row.classList.add("active-dealer");
    const team = state.playMode === "teams" ? `<span class="entry-team">Team ${escapeHtml(player.team)}</span>` : "";
    row.innerHTML = `
      <div class="entry-name">${escapeHtml(playerName(player, index))}${team}${player.id === currentDealerId() ? '<span class="dealer-badge">Dealer</span>' : ""}</div>
      <label class="mini-field">Bid <input class="bid-input" type="number" min="0" max="${round.cards}" step="1" value="" placeholder="0" inputmode="numeric" enterkeyhint="next"></label>
      <label class="mini-field">Took <input class="tricks-input" type="number" min="0" max="${round.cards}" step="1" value="" placeholder="0" inputmode="numeric" enterkeyhint="next"></label>
      <label class="board-toggle">Board <input class="board-input" type="checkbox"></label>
    `;
    row.querySelector(".board-input").addEventListener("change", (event) => {
      row.querySelector(".bid-input").value = event.target.checked ? round.cards : row.querySelector(".bid-input").value;
      row.classList.toggle("board-armed", event.target.checked);
      updateTrickTotal(round);
    });
    row.querySelectorAll(".bid-input, .tricks-input").forEach((input) => prepareScoreInput(input, round));
    els.roundEntry.append(row);
  });
  updateTrickTotal(round);
}

function prepareScoreInput(input, round) {
  input.addEventListener("focus", () => {
    if (input.value === "0") input.value = "";
    input.select();
  });
  input.addEventListener("input", () => updateTrickTotal(round));
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const selector = input.classList.contains("bid-input") ? ".bid-input" : ".tricks-input";
    const inputs = [...els.roundEntry.querySelectorAll(selector)];
    const nextInput = inputs[inputs.indexOf(input) + 1];
    if (nextInput) {
      nextInput.focus();
      return;
    }
    if (selector === ".bid-input") {
      els.roundEntry.querySelector(".tricks-input")?.focus();
    } else {
      document.querySelector("#save-round").focus();
    }
  });
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
    const members = state.players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.team === team)
      .map(({ player, index }) => playerName(player, index))
      .join(", ") || "No players";
    const card = document.createElement("div");
    card.className = "team-total";
    card.innerHTML = `<span>Team ${team}</span><strong>${total}</strong><em>${escapeHtml(members)}</em>`;
    els.teamTotals.append(card);
  });
}

function renderStandingsList() {
  const scores = currentScores();
  const ranked = state.players
    .map((player, index) => ({ player, index, score: scores[player.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  els.standingsList.innerHTML = ranked.map(({ player, index, score }, rank) => {
    const team = state.playMode === "teams" ? `<span>Team ${escapeHtml(player.team)}</span>` : "";
    const dealer = player.id === currentDealerId() ? '<span class="dealer-badge compact-badge">Dealer</span>' : "";
    return `
      <div class="standing-row">
        <strong>${rank + 1}</strong>
        <div>${escapeHtml(playerName(player, index))}${team}${dealer}</div>
        <b>${score}</b>
      </div>
    `;
  }).join("");
}

function renderBidStats() {
  const stats = currentBidStats();
  els.bidStats.innerHTML = state.players.map((player, index) => {
    const stat = stats[player.id];
    const team = state.playMode === "teams" ? `<span class="stat-team">Team ${escapeHtml(player.team)}</span>` : "";
    return `
      <div class="stat-card">
        <strong>${escapeHtml(playerName(player, index))}</strong>
        ${team}
        <span>${stat.hit} hit</span>
        <span>${stat.under} under</span>
      </div>
    `;
  }).join("");
}

function renderScoreboard() {
  const scores = currentScores();
  const leaders = state.players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => scores[b.player.id] - scores[a.player.id]);
  const head = `<thead><tr><th>Round</th>${leaders.map(({ player, index }) => {
    const team = state.playMode === "teams" ? `<span class="score-team">Team ${escapeHtml(player.team)}</span>` : "";
    return `<th>${escapeHtml(playerName(player, index))}${team}</th>`;
  }).join("")}</tr></thead>`;
  const bodyRows = state.history.map((round, index) => {
    const entriesByPlayer = Object.fromEntries(round.entries.map((entry) => [entry.playerId, entry]));
    const dealer = dealerForRound(index);
    const dealerIndex = state.players.findIndex((player) => player.id === dealer?.id);
    const dealerText = dealer ? `<span class="score-delta">Dealer: ${escapeHtml(playerName(dealer, dealerIndex))}</span>` : "";
    return `<tr><td>${index + 1}. ${round.cards}${dealerText}</td>${leaders.map(({ player }) => {
      const entry = entriesByPlayer[player.id];
      if (!entry) return "<td>0<span class=\"score-delta\">not seated</span></td>";
      const delta = scoreRound(entry);
      const label = entry.board ? "board" : `bid ${entry.bid}`;
      return `<td>${delta > 0 ? "+" : ""}${delta}<span class="score-delta">${label}, took ${entry.tricks}</span></td>`;
    }).join("")}</tr>`;
  }).join("");
  const foot = `<tfoot><tr><th>Total</th>${leaders.map(({ player }) => `<td>${scores[player.id]}</td>`).join("")}</tr></tfoot>`;
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
    const winners = state.players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => scores[player.id] === best);
    const leaderChanged = winners.some(({ player }) => scores[player.id] > (previousScores[player.id] || 0));
    return {
      type: "win",
      title: winners.length === 1
        ? `${playerName(winners[0].player, winners[0].index)} wins`
        : `${winners.map(({ player, index }) => playerName(player, index)).join(" and ")} tie`,
      detail: `Final score: ${best}`,
      confetti: true,
      banner: leaderChanged ? "Final round shook up the table." : "Final scores are in."
    };
  }

  if (madeBoards.length) {
    const names = madeBoards.map((entry) => playerName(entry.player, state.players.indexOf(entry.player))).join(" and ");
    return {
      type: "board",
      title: `${names} made board`,
      detail: `+${madeBoards.reduce((sum, entry) => sum + entry.delta, 0)} board points`,
      confetti: true,
      banner: `${names} called board and got it.`
    };
  }

  if (missedBoards.length) {
    const names = missedBoards.map((entry) => playerName(entry.player, state.players.indexOf(entry.player))).join(" and ");
    return {
      type: "miss",
      title: `${names} missed board`,
      detail: `${missedBoards.reduce((sum, entry) => sum + entry.delta, 0)} points`,
      confetti: false,
      banner: `${names} called board and missed.`
    };
  }

  const biggestGain = rows.reduce((best, entry) => entry.delta > best.delta ? entry : best, rows[0]);
  const playerIndex = state.players.findIndex((candidate) => candidate.id === biggestGain.playerId);
  const player = state.players[playerIndex];
  return {
    type: "plain",
    banner: player && biggestGain.delta > 0 ? `${playerName(player, playerIndex)} led the round with +${biggestGain.delta}.` : "Round saved."
  };
}

function showRoundEvent(event) {
  if (!event) return;
  if (event.type === "plain") return;
  playEventSound(event.type);
  showBanner(event.banner, event.type);
  showCelebration(event);
}

function playEventSound(type) {
  const sound = sounds[type === "miss" ? "miss" : type === "board" ? "board" : ""];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
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
      totals[entry.playerId] = (totals[entry.playerId] || 0) + scoreRound(entry);
    });
  });
  return totals;
}

function currentBidStats() {
  const stats = Object.fromEntries(state.players.map((player) => [player.id, { hit: 0, under: 0 }]));
  state.history.forEach((round) => {
    round.entries.forEach((entry) => {
      if (!stats[entry.playerId]) return;
      if (entry.tricks === entry.bid) {
        stats[entry.playerId].hit += 1;
      } else if (entry.tricks < entry.bid) {
        stats[entry.playerId].under += 1;
      }
    });
  });
  return stats;
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
    name: row.querySelector(".player-name").value.trim(),
    team: row.querySelector(".team-select").value
  }));
  const dealerRow = [...els.playerList.querySelectorAll(".player-row")]
    .find((row) => row.querySelector(".dealer-input").checked);
  state.startingDealerId = dealerRow ? dealerRow.dataset.playerId : "";
  save();
}

function syncSettingsFromDom({ clampRounds }) {
  state.playMode = els.playMode.value;
  state.deckSize = clamp(numberValue(els.deckSize, state.deckSize), 20, 108);
  state.maxCards = numberValue(els.maxCards, state.maxCards);
  state.boardPoints = numberValue(els.boardPoints, state.boardPoints);
  state.boardMissPoints = numberValue(els.boardMissPoints, state.boardMissPoints);
  state.hitPoints = numberValue(els.hitPoints, state.hitPoints);
  state.underPoints = numberValue(els.underPoints, state.underPoints);
  if (clampRounds) {
    state.maxCards = clamp(state.maxCards, 1, maxPossibleCards());
    state.boardPoints = clamp(state.boardPoints, 0, 50);
    state.boardMissPoints = clamp(state.boardMissPoints, 0, 50);
    state.hitPoints = clamp(state.hitPoints, 0, 50);
    state.underPoints = clamp(state.underPoints, 0, 50);
  }
  els.roundPreview.textContent = `1 to ${state.maxCards} to 1`;
  renderScoringRules();
  save();
}

function commitNumericSettings() {
  syncSettingsFromDom({ clampRounds: true });
  render();
}

function syncRoundEntries() {
  if (state.mode === "game") save();
}

function maxPossibleCards() {
  return clamp(Math.floor((state.deckSize - 1) / Math.max(state.players.length, 1)), 1, 26);
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
    if (!["home", "setup", "game"].includes(state.mode)) state.mode = "home";
    state.selectedCategory = state.selectedCategory || "";
    state.selectedGame = state.selectedGame || "";
    state.activeTab = ["score", "table", "stats", "rounds"].includes(state.activeTab) ? state.activeTab : "score";
    state.setupTab = ["rules", "players"].includes(state.setupTab) ? state.setupTab : "rules";
    if (state.mode === "setup" && !state.selectedGame && !state.history.length) state.mode = "home";
    state.boardPoints = numberValue({ value: state.boardPoints }, 5);
    state.boardMissPoints = numberValue({ value: state.boardMissPoints }, 5);
    state.hitPoints = numberValue({ value: state.hitPoints }, 3);
    state.underPoints = numberValue({ value: state.underPoints }, 3);
    if (!state.players.some((player) => player.id === state.startingDealerId)) {
      state.startingDealerId = "";
    }
    if (usesOriginalSampleNames() && state.history.length === 0) {
      state.players = createDefaultPlayers();
      state.maxCards = maxPossibleCards();
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function ensureStartingDealer() {
  if (state.players.some((player) => player.id === state.startingDealerId)) return;
  const randomIndex = Math.floor(Math.random() * state.players.length);
  state.startingDealerId = state.players[randomIndex].id;
}

function currentDealerId() {
  return dealerForRound(state.history.length)?.id || "";
}

function dealerForRound(roundIndex) {
  if (!state.players.length) return null;
  const startIndex = Math.max(0, state.players.findIndex((player) => player.id === state.startingDealerId));
  return state.players[(startIndex + roundIndex) % state.players.length];
}

function renderDealerLine() {
  const dealer = dealerForRound(state.history.length);
  const dealerIndex = state.players.findIndex((player) => player.id === dealer?.id);
  els.dealerLine.textContent = dealer ? `Dealer: ${playerName(dealer, dealerIndex)}` : "Dealer: random on start";
}

function renderScoringRules() {
  els.boardRule.textContent = `+${state.boardPoints} x tricks`;
  els.boardMissRule.textContent = `-${state.boardMissPoints} x board bid`;
  els.hitRule.textContent = `+${state.hitPoints} x tricks`;
  els.underRule.textContent = `-${state.underPoints} x bid`;
  els.overRule.textContent = "+1 x tricks";
}

async function toggleWakeLock() {
  if (wakeLockSentinel) {
    wakeLockRequested = false;
    await releaseWakeLock();
    showWakeLockState("Wake");
    return;
  }

  wakeLockRequested = true;
  await requestWakeLock();
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    wakeLockRequested = false;
    showWakeLockState("Not supported");
    window.setTimeout(() => showWakeLockState("Wake"), 2600);
    return;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    showWakeLockState("Awake", true);
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
      if (!wakeLockRequested) showWakeLockState("Wake");
    });
  } catch {
    wakeLockSentinel = null;
    wakeLockRequested = false;
    showWakeLockState("Wake failed");
    window.setTimeout(() => showWakeLockState("Wake"), 2600);
  }
}

async function releaseWakeLock() {
  if (!wakeLockSentinel) return;
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  await sentinel.release();
}

function restoreWakeLock() {
  if (document.visibilityState === "visible" && wakeLockRequested && !wakeLockSentinel) {
    requestWakeLock();
  }
}

function showWakeLockState(label, active = false) {
  els.wakeLockButton.textContent = label;
  els.wakeLockButton.classList.toggle("active", active);
  els.wakeLockButton.setAttribute("aria-pressed", active ? "true" : "false");
}

function playerName(player, index) {
  return player.name || `Player ${index + 1}`;
}

function createDefaultPlayers() {
  return [0, 1, 2].map((index) => ({
    id: makeId(),
    name: "",
    team: index % 2 === 0 ? "A" : "B"
  }));
}

function usesOriginalSampleNames() {
  const names = state.players.map((player) => player.name).join("|");
  return names === "Mom|Dad|Taegan|Guest";
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
