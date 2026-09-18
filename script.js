// ==========================================
// FOOTBALLER - GAME
// ==========================================

// ==========================================
// SOUND ENGINE (synthesized, no audio files)
// ==========================================

let audioCtx = null;

// Migrate the old single "soundMuted" flag into the new SFX-specific
// key so nobody's existing mute preference gets silently reset.
let sfxMuted =
    localStorage.getItem("sfxMuted") !== null
        ? localStorage.getItem("sfxMuted") === "true"
        : localStorage.getItem("soundMuted") === "true";

let sfxVolume = Number(localStorage.getItem("sfxVolume")) || 80;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTone(freq, startTime, duration, type = "sine", vol = 0.15) {

    if (sfxMuted) return;

    try {

        const ctx = getAudioCtx();

        const osc = ctx.createOscillator();

        const gain = ctx.createGain();

        const scaledVol = vol * (sfxVolume / 100);

        osc.type = type;

        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);

        gain.gain.linearRampToValueAtTime(scaledVol, ctx.currentTime + startTime + 0.01);

        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        osc.connect(gain);

        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);

        osc.stop(ctx.currentTime + startTime + duration + 0.05);

    } catch (e) {
        // audio not available, fail silently
    }
}
// ==========================================
// SFX — file-based playback
// ==========================================

const SFX_FILES = {
    click:   "sounds/click.wav",
    select:  "sounds/select.wav",
    correct: "sounds/correct.wav",
    close:   "sounds/close.wav",
    wrong:   "sounds/wrong.mp3",
    hint:    "sounds/hint.wav",
    win:     "sounds/win.wav",
    lose:    "sounds/lose.wav",
    hover:   "sounds/hover.wav",
    back:    "sounds/back.wav",
};

const SFX_BUFFERS = {};

async function preloadSfx() {

    const ctx = getAudioCtx();

    for (const [name, url] of Object.entries(SFX_FILES)) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn("SFX missing:", url);
                continue;
            }
            const arr = await res.arrayBuffer();
            SFX_BUFFERS[name] = await ctx.decodeAudioData(arr);
        } catch (e) {
            console.warn("Failed to load SFX:", name, url, e);
        }

    }

}

function playSfx(name) {

    if (sfxMuted) return;

    const buffer = SFX_BUFFERS[name];
    if (!buffer) return;

    try {

        const ctx = getAudioCtx();

        const src = ctx.createBufferSource();
        const gain = ctx.createGain();

        src.buffer = buffer;
        gain.gain.value = sfxVolume / 100;

        src.connect(gain);
        gain.connect(ctx.destination);

        src.start(0);

    } catch (e) {
        // audio not available, fail silently
    }

}

function sfxClick()   { playSfx("click"); }
function sfxSelect()  { playSfx("select"); }
function sfxCorrect() { playSfx("correct"); }
function sfxClose()   { playSfx("close"); }
function sfxWrong()   { playSfx("wrong"); }
function sfxHint()    { playSfx("hint"); }
function sfxWin()     { playSfx("win"); }
function sfxHover() { playSfx("hover"); }
function sfxBack() { playSfx("back"); }
function sfxLose()    { playSfx("lose"); }

preloadSfx();

// ==========================================
// BACKGROUND MUSIC
// (a small generative ambient pad loop — no audio file needed)
// ==========================================

let bgmMuted = localStorage.getItem("bgmMuted") === "true";
let bgmVolume = Number(localStorage.getItem("bgmVolume")) || 35;

let bgmMasterGain = null;
let bgmSchedulerTimeout = null;
let bgmChordIndex = 0;

const BGM_MAX_GAIN = 0.05; // stays subtle even at 100% on the slider
const BGM_CHORD_SECONDS = 4.5;

// A soft, slow vi–IV–I–V loop (A minor, F, C, G) — pleasant and
// unobtrusive under gameplay, never draws attention to itself.
const BGM_CHORDS = [
    [220.00, 261.63, 329.63], // Am
    [174.61, 220.00, 261.63], // F
    [261.63, 329.63, 392.00], // C
    [196.00, 246.94, 293.66]  // G
];

function bgmPlayChord(ctx, freqs, startTime, duration) {
    freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(1 / freqs.length, ctx.currentTime + startTime + duration * 0.4);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(bgmMasterGain);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration + 0.1);
    });
}

function bgmScheduleLoop() {
    if (!bgmMasterGain) return;

    const ctx = getAudioCtx();
    const chord = BGM_CHORDS[bgmChordIndex % BGM_CHORDS.length];

    bgmPlayChord(ctx, chord, 0, BGM_CHORD_SECONDS);
    bgmChordIndex++;

    // Slight overlap between chords keeps the loop smooth rather than gappy.
    bgmSchedulerTimeout = setTimeout(bgmScheduleLoop, BGM_CHORD_SECONDS * 1000 * 0.92);
}

function startBGM() {
    if (bgmMasterGain || bgmMuted) return;

    try {
        const ctx = getAudioCtx();
        bgmMasterGain = ctx.createGain();
        bgmMasterGain.gain.value = (bgmVolume / 100) * BGM_MAX_GAIN;
        bgmMasterGain.connect(ctx.destination);
        bgmChordIndex = 0;
        bgmScheduleLoop();
    } catch (e) {
        // audio not available, fail silently
    }
}

function stopBGM() {
    if (bgmSchedulerTimeout) {
        clearTimeout(bgmSchedulerTimeout);
        bgmSchedulerTimeout = null;
    }

    if (bgmMasterGain) {
        try {
            bgmMasterGain.disconnect();
        } catch (e) {
            // already disconnected
        }
        bgmMasterGain = null;
    }
}

function updateBgmGain() {
    if (bgmMasterGain) {
        bgmMasterGain.gain.setTargetAtTime(
            (bgmVolume / 100) * BGM_MAX_GAIN,
            getAudioCtx().currentTime,
            0.15
        );
    }
}

// Autoplay policies require a user gesture before audio can start —
// this quietly primes the audio context and starts BGM on the very
// first tap/click/keypress, so nothing plays unprompted.
function primeAudioOnFirstInteraction() {

    const unlock = () => {
        getAudioCtx();
        if (!bgmMuted) startBGM();
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
    };

    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

}

primeAudioOnFirstInteraction();



// ==========================================
// PLAYER DATABASE
// ==========================================

const players = [

    // =========================
    // REAL MADRID
    // =========================

    // =========================
    // REAL MADRID
    // =========================

{ name: "Brahim Diaz", country: "Morocco", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 27, foot: "left" },

{ name: "Ibrahima Konaté", country: "France", club: "Real Madrid", position: "Defender", league: "La Liga", age: 27, foot: "Right" },

{ name: "Kylian Mbappe", country: "France", club: "Real Madrid", position: "Forward", league: "La Liga", age: 27, foot: "Right" },

{ name: "Vinicius Junior", country: "Brazil", club: "Real Madrid", position: "Winger", league: "La Liga", age: 26, foot: "Right" },

{ name: "Jude Bellingham", country: "England", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 23, foot: "Right" },

{ name: "Rodrygo", country: "Brazil", club: "Real Madrid", position: "Winger", league: "La Liga", age: 25, foot: "Right" },

{ name: "Federico Valverde", country: "Uruguay", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 28, foot: "Right" },

{ name: "Thibaut Courtois", country: "Belgium", club: "Real Madrid", position: "Goalkeeper", league: "La Liga", age: 34, foot: "Left" },

{ name: "Bernardo Silva", country: "Portugal", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 32, foot: "Left" },

{ name: "Yan Diomandé", country: "Ivory Coast", club: "Real Madrid", position: "Winger", league: "La Liga", age: 19, foot: "Right" },

{ name: "Denzel Dumfries", country: "Netherlands", club: "Real Madrid", position: "Defender", league: "La Liga", age: 30, foot: "Right" },

{ name: "Trent Alexander-Arnold", country: "England", club: "Real Madrid", position: "Defender", league: "La Liga", age: 27, foot: "Right" },

    // =========================
    // BARCELONA
    // =========================

{ name: "Lamine Yamal", country: "Spain", club: "Barcelona", position: "Winger", league: "La Liga", age: 19, foot: "Left" },

{ name: "Pedri", country: "Spain", club: "Barcelona", position: "Midfielder", league: "La Liga", age: 23, foot: "Right" },

{ name: "Raphinha", country: "Brazil", club: "Barcelona", position: "Winger", league: "La Liga", age: 29, foot: "Left" },

{ name: "Anthony Gordon", country: "England", club: "Barcelona", position: "Winger", league: "La Liga", age: 25, foot: "Right" },

{ name: "Frenkie de Jong", country: "Netherlands", club: "Barcelona", position: "Midfielder", league: "La Liga", age: 29, foot: "Right" },

{ name: "Karim Adeyemi", country: "Germany", club: "Barcelona", position: "Winger", league: "La Liga", age: 24, foot: "Left" },

{ name: "Rodri", country: "Spain", club: "Barcelona", position: "Midfielder", league: "La Liga", age: 30, foot: "Right" },

    // =========================
    // MANCHESTER CITY
    // =========================

{ name: "Erling Haaland", country: "Norway", club: "Manchester City", position: "Forward", league: "Premier League", age: 26, foot: "Left" },

{ name: "Phil Foden", country: "England", club: "Manchester City", position: "Midfielder", league: "Premier League", age: 26, foot: "Left" },

{ name: "Rayan Ait-Nouri", country: "Algeria", club: "Manchester City", position: "Defender", league: "Premier League", age: 25, foot: "Left" },

{ name: "Rayan Cherki", country: "France", club: "Manchester City", position: "Midfielder", league: "Premier League", age: 23, foot: "Left" },

{ name: "Elliot Anderson", country: "England", club: "Manchester City", position: "Midfielder", league: "Premier League", age: 23, foot: "Left" },

{ name: "Ayyoub Bouaddi", country: "Morocco", club: "Manchester City", position: "Midfielder", league: "Premier League", age: 18, foot: "Right" },

{ name: "Antoine Semenyo", country: "Ghana", club: "Manchester City", position: "Forward", league: "Premier League", age: 26, foot: "Right" },

    // =========================
    // LIVERPOOL
    // =========================

{ name: "Mohamed Salah", country: "Egypt", club: "Liverpool", position: "Winger", league: "Premier League", age: 34, foot: "Left" },

{ name: "Virgil van Dijk", country: "Netherlands", club: "Liverpool", position: "Defender", league: "Premier League", age: 35, foot: "Right" },

{ name: "Alisson Becker", country: "Brazil", club: "Liverpool", position: "Goalkeeper", league: "Premier League", age: 33, foot: "Right" },

    // =========================
    // ARSENAL
    // =========================

{ name: "Bukayo Saka", country: "England", club: "Arsenal", position: "Winger", league: "Premier League", age: 25, foot: "Left" },

{ name: "Martin Odegaard", country: "Norway", club: "Arsenal", position: "Midfielder", league: "Premier League", age: 27, foot: "Left" },

{ name: "Declan Rice", country: "England", club: "Arsenal", position: "Midfielder", league: "Premier League", age: 27, foot: "Right" },

    // =========================
    // MANCHESTER UNITED
    // =========================

{ name: "Bruno Fernandes", country: "Portugal", club: "Manchester United", position: "Midfielder", league: "Premier League", age: 32, foot: "Right" },

{ name: "Casemiro", country: "Brazil", club: "Manchester United", position: "Midfielder", league: "Premier League", age: 34, foot: "Right" },

    // =========================
    // PSG
    // =========================

{ name: "Ousmane Dembele", country: "France", club: "Paris Saint-Germain", position: "Winger", league: "Ligue 1", age: 29, foot: "Right" },

{ name: "Achraf Hakimi", country: "Morocco", club: "Paris Saint-Germain", position: "Defender", league: "Ligue 1", age: 27, foot: "Right" },

{ name: "Khvicha Kvaratskhelia", country: "Georgia", club: "Paris Saint-Germain", position: "Winger", league: "Ligue 1", age: 25, foot: "Right" },

    // =========================
    // BAYERN
    // =========================

{ name: "Harry Kane", country: "England", club: "Bayern Munich", position: "Forward", league: "Bundesliga", age: 33, foot: "Right" },

{ name: "Jamal Musiala", country: "Germany", club: "Bayern Munich", position: "Midfielder", league: "Bundesliga", age: 23, foot: "Right" },

{ name: "Manuel Neuer", country: "Germany", club: "Bayern Munich", position: "Goalkeeper", league: "Bundesliga", age: 40, foot: "Right" },

    // =========================
    // INTER
    // =========================

{ name: "Lautaro Martinez", country: "Argentina", club: "Inter Milan", position: "Forward", league: "Serie A", age: 29, foot: "Right" },

{ name: "Nicolo Barella", country: "Italy", club: "Inter Milan", position: "Midfielder", league: "Serie A", age: 29, foot: "Right" },

    // =========================
    // BESIKTAS
    // =========================

{ name: "Dusan Vlahovic", country: "Serbia", club: "Besiktas", position: "Forward", league: "Super Lig", age: 26, foot: "Left" },

    // =========================
    // GALATASARAY
    // =========================

{ name: "Rafael Leao", country: "Portugal", club: "Galatasaray", position: "Winger", league: "Super Lig", age: 27, foot: "Right" },

    // =========================
    // ATLETICO MADRID
    // =========================

{ name: "Antoine Griezmann", country: "France", club: "Atletico Madrid", position: "Forward", league: "La Liga", age: 35, foot: "Left" },

    // =========================
    // OTHER BIG PLAYERS
    // =========================

{ name: "Cristiano Ronaldo", country: "Portugal", club: "Al Nassr", position: "Forward", league: "Saudi Pro League", age: 41, foot: "Right" },

{ name: "Lionel Messi", country: "Argentina", club: "Inter Miami", position: "Forward", league: "MLS", age: 39, foot: "Left" },

{ name: "Neymar Jr", country: "Brazil", club: "Santos", position: "Forward", league: "Brazil Serie A", age: 34, foot: "Right" },

{ name: "Kevin De Bruyne", country: "Belgium", club: "Napoli", position: "Midfielder", league: "Serie A", age: 35, foot: "Right" },

{ name: "Luka Modric", country: "Croatia", club: "AC Milan", position: "Midfielder", league: "Serie A", age: 40, foot: "Right" },

{ name: "Son Heung-min", country: "South Korea", club: "LAFC", position: "Forward", league: "MLS", age: 34, foot: "Left" },

    // =========================
    // MORE MEDIUM PLAYERS
    // =========================

{ name: "Marcus Rashford", country: "England", club: "Manchester United", position: "Forward", league: "Premier League", age: 28, foot: "Right" },

{ name: "Alexander Isak", country: "Sweden", club: "Liverpool", position: "Forward", league: "Premier League", age: 26, foot: "Right" },

{ name: "Florian Wirtz", country: "Germany", club: "Liverpool", position: "Midfielder", league: "Premier League", age: 23, foot: "Right" },

{ name: "Victor Osimhen", country: "Nigeria", club: "Galatasaray", position: "Forward", league: "Super Lig", age: 27, foot: "Right" },

{ name: "William Saliba", country: "France", club: "Arsenal", position: "Defender", league: "Premier League", age: 25, foot: "Right" },

{ name: "Joshua Kimmich", country: "Germany", club: "Bayern Munich", position: "Midfielder", league: "Bundesliga", age: 31, foot: "Right" },

{ name: "Joao Cancelo", country: "Portugal", club: "Al-Hilal", position: "Defender", league: "Saudi Pro League", age: 32, foot: "Left" },

{ name: "Randal Kolo Muani", country: "France", club: "Juventus", position: "Forward", league: "Serie A", age: 27, foot: "Right" },

    // =========================
    // MORE HARD PLAYERS
    // =========================

{ name: "Nuno Mendes", country: "Portugal", club: "Paris Saint-Germain", position: "Defender", league: "Ligue 1", age: 24, foot: "Left" },

{ name: "Warren Zaire-Emery", country: "France", club: "Paris Saint-Germain", position: "Midfielder", league: "Ligue 1", age: 20, foot: "Right" },

{ name: "Gavi", country: "Spain", club: "Barcelona", position: "Midfielder", league: "La Liga", age: 22, foot: "Right" },

{ name: "Eduardo Camavinga", country: "France", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 23, foot: "Left" },

{ name: "Xavi Simons", country: "Netherlands", club: "Tottenham Hotspur", position: "Midfielder", league: "Premier League", age: 23, foot: "Right" },

{ name: "Micky van de Ven", country: "Netherlands", club: "Tottenham Hotspur", position: "Defender", league: "Premier League", age: 25, foot: "Left" },

{ name: "Amadou Onana", country: "Belgium", club: "Aston Villa", position: "Midfielder", league: "Premier League", age: 24, foot: "Right" },

{ name: "Khephren Thuram", country: "France", club: "Juventus", position: "Midfielder", league: "Serie A", age: 24, foot: "Right" },

    // =========================
    // MORE PLAYERS
    // =========================

{ name: "Ademola Lookman", country: "Nigeria", club: "Atletico Madrid", position: "Forward", league: "La Liga", age: 28, foot: "Right" },

{ name: "Viktor Gyokeres", country: "Sweden", club: "Arsenal", position: "Forward", league: "Premier League", age: 28, foot: "Right" },

{ name: "Federico Chiesa", country: "Italy", club: "Liverpool", position: "Winger", league: "Premier League", age: 29, foot: "Right" },

{ name: "Moises Caicedo", country: "Ecuador", club: "Chelsea", position: "Midfielder", league: "Premier League", age: 24, foot: "Right" },

{ name: "Cole Palmer", country: "England", club: "Chelsea", position: "Midfielder", league: "Premier League", age: 24, foot: "Left" },

{ name: "Enzo Fernandez", country: "Argentina", club: "Chelsea", position: "Midfielder", league: "Premier League", age: 25, foot: "Right" },

{ name: "Alejandro Garnacho", country: "Argentina", club: "Chelsea", position: "Winger", league: "Premier League", age: 22, foot: "Left" },

{ name: "Leny Yoro", country: "France", club: "Manchester United", position: "Defender", league: "Premier League", age: 20, foot: "Right" },

{ name: "Kobbie Mainoo", country: "England", club: "Manchester United", position: "Midfielder", league: "Premier League", age: 21, foot: "Right" },

{ name: "Desire Doue", country: "France", club: "Paris Saint-Germain", position: "Winger", league: "Ligue 1", age: 21, foot: "Left" },

{ name: "Bradley Barcola", country: "France", club: "Paris Saint-Germain", position: "Winger", league: "Ligue 1", age: 23, foot: "Left" },

{ name: "Pau Cubarsi", country: "Spain", club: "Barcelona", position: "Defender", league: "La Liga", age: 19, foot: "Right" },

{ name: "Dani Olmo", country: "Spain", club: "Barcelona", position: "Midfielder", league: "La Liga", age: 28, foot: "Right" },

{ name: "Ferran Torres", country: "Spain", club: "Paris Saint-Germain", position: "Forward", league: "Ligue 1", age: 26, foot: "Right" },

{ name: "Endrick", country: "Brazil", club: "Real Madrid", position: "Forward", league: "La Liga", age: 20, foot: "Right" },

{ name: "Arda Guler", country: "Turkey", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 21, foot: "Left" },

{ name: "Dean Huijsen", country: "Spain", club: "Real Madrid", position: "Defender", league: "La Liga", age: 21, foot: "Left" },

{ name: "Mathys Tel", country: "France", club: "Tottenham Hotspur", position: "Forward", league: "Premier League", age: 21, foot: "Right" },

{ name: "Kaoru Mitoma", country: "Japan", club: "Brighton", position: "Winger", league: "Premier League", age: 29, foot: "Left" },

{ name: "Amine Adli", country: "Morocco", club: "Bayer Leverkusen", position: "Winger", league: "Bundesliga", age: 26, foot: "Right" },

    // =========================
    // GOALKEEPERS
    // =========================

{ name: "Gianluigi Donnarumma", country: "Italy", club: "Manchester City", position: "Goalkeeper", league: "Premier League", age: 27, foot: "Right" },

{ name: "Marc-Andre ter Stegen", country: "Germany", club: "Ajax", position: "Goalkeeper", league: "Eredivisie", age: 34, foot: "Right" },

{ name: "Mike Maignan", country: "France", club: "AC Milan", position: "Goalkeeper", league: "Serie A", age: 31, foot: "Left" },

{ name: "David Raya", country: "Spain", club: "Arsenal", position: "Goalkeeper", league: "Premier League", age: 31, foot: "Right" },

{ name: "Jan Oblak", country: "Slovenia", club: "Atletico Madrid", position: "Goalkeeper", league: "La Liga", age: 33, foot: "Right" },

    // =========================
    // MORE DEFENDERS
    // =========================

{ name: "Ruben Dias", country: "Portugal", club: "Manchester City", position: "Defender", league: "Premier League", age: 29, foot: "Right" },

{ name: "Antonio Rudiger", country: "Germany", club: "Real Madrid", position: "Defender", league: "La Liga", age: 33, foot: "Right" },

{ name: "Alessandro Bastoni", country: "Italy", club: "Inter Milan", position: "Defender", league: "Serie A", age: 27, foot: "Left" },

{ name: "Theo Hernandez", country: "France", club: "Al-Hilal", position: "Defender", league: "Saudi Pro League", age: 28, foot: "Left" },

    // =========================
    // MORE MIDFIELDERS
    // =========================

{ name: "Vitinha", country: "Portugal", club: "Paris Saint-Germain", position: "Midfielder", league: "Ligue 1", age: 26, foot: "Right" },

{ name: "Fabian Ruiz", country: "Spain", club: "Paris Saint-Germain", position: "Midfielder", league: "Ligue 1", age: 30, foot: "Left" },

{ name: "Martin Zubimendi", country: "Spain", club: "Arsenal", position: "Midfielder", league: "Premier League", age: 27, foot: "Right" },

    // =========================
    // MORE FORWARDS
    // =========================

{ name: "Ollie Watkins", country: "England", club: "Al-Hilal", position: "Forward", league: "Saudi Pro League", age: 30, foot: "Right" },

{ name: "Serhou Guirassy", country: "Guinea", club: "Borussia Dortmund", position: "Forward", league: "Bundesliga", age: 30, foot: "Right" },

{ name: "Michael Olise", country: "France", club: "Bayern Munich", position: "Winger", league: "Bundesliga", age: 24, foot: "Right" },

{ name: "Omar Marmoush", country: "Egypt", club: "Manchester City", position: "Forward", league: "Premier League", age: 27, foot: "Left" },

    // =========================
    // GLOBAL STARS
    // =========================

{ name: "Denis Bouanga", country: "Gabon", club: "LAFC", position: "Forward", league: "MLS", age: 31, foot: "Right" },

{ name: "N'Golo Kante", country: "France", club: "Fenerbahce", position: "Midfielder", league: "Super Lig", age: 35, foot: "Right" },

{ name: "Sadio Mane", country: "Senegal", club: "Al-Nassr", position: "Forward", league: "Saudi Pro League", age: 34, foot: "Right" },

{ name: "Riyad Mahrez", country: "Algeria", club: "Al-Ahli", position: "Winger", league: "Saudi Pro League", age: 35, foot: "Left" },

{ name: "Mohammed Kudus", country: "Ghana", club: "Tottenham", position: "Midfielder", league: "Premier League", age: 25, foot: "Right" },

{ name: "Takefusa Kubo", country: "Japan", club: "Real Sociedad", position: "Winger", league: "La Liga", age: 25, foot: "Left" },

    // =========================
    // MORE PLAYERS (2026/2027)
    // =========================

{ name: "Julian Alvarez", country: "Argentina", club: "Atletico Madrid", position: "Forward", league: "La Liga", age: 26, foot: "Right" },

{ name: "Scott McTominay", country: "Scotland", club: "Napoli", position: "Midfielder", league: "Serie A", age: 29, foot: "Right" },

{ name: "Romelu Lukaku", country: "Belgium", club: "Fenerbahce", position: "Forward", league: "Super Lig", age: 33, foot: "Right" },

{ name: "Christian Pulisic", country: "USA", club: "AC Milan", position: "Winger", league: "Serie A", age: 27, foot: "Right" },

{ name: "Aurelien Tchouameni", country: "France", club: "Real Madrid", position: "Midfielder", league: "La Liga", age: 26, foot: "Right" },

{ name: "Leroy Sane", country: "Germany", club: "Galatasaray", position: "Winger", league: "Super Lig", age: 30, foot: "Left" },

{ name: "Dayot Upamecano", country: "France", club: "Bayern Munich", position: "Defender", league: "Bundesliga", age: 27, foot: "Right" },

{ name: "Julian Brandt", country: "Germany", club: "Ajax", position: "Midfielder", league: "Eredivisie", age: 30, foot: "Right" },

{ name: "Bruno Guimaraes", country: "Brazil", club: "Arsenal", position: "Midfielder", league: "Premier League", age: 28, foot: "Right" },

{ name: "Emiliano Martinez", country: "Argentina", club: "Chelsea", position: "Goalkeeper", league: "Premier League", age: 34, foot: "Right" },

{ name: "James Maddison", country: "England", club: "Tottenham", position: "Midfielder", league: "Premier League", age: 29, foot: "Right" },

{ name: "Nicolas Jackson", country: "Senegal", club: "Aston Villa", position: "Forward", league: "Premier League", age: 25, foot: "Right" },

{ name: "Rasmus Højlund", country: "Denmark", club: "SSC Napoli", position: "Forward", league: "Serie A", age: 23, foot: "Left" },

{ name: "Victor Boniface", country: "Nigeria", club: "Bayer Leverkusen", position: "Forward", league: "Bundesliga", age: 25, foot: "Right" },

{ name: "Goncalo Ramos", country: "Portugal", club: "AC Milan", position: "Forward", league: "Serie A", age: 25, foot: "Right" },

{ name: "Andre Onana", country: "Cameroon", club: "Trabzonspor", position: "Goalkeeper", league: "Super Lig", age: 30, foot: "Right" },

{ name: "Manuel Akanji", country: "Switzerland", club: "Inter Milan", position: "Defender", league: "Serie A", age: 31, foot: "Right" },

{ name: "Alphonso Davies", country: "Canada", club: "Bayern Munich", position: "Defender", league: "Bundesliga", age: 25, foot: "Left" },

    // =========================
    // LEGENDS (retired icons)
    // =========================

{ name: "Zinedine Zidane", country: "France", club: "Real Madrid", position: "Midfielder", league: "Legends", hintLeague: "La Liga", age: 53, foot: "Right", isLegend: true },

{ name: "David Beckham", country: "England", club: "Manchester United", position: "Midfielder", league: "Legends", hintLeague: "Premier League", age: 51, foot: "Right", isLegend: true },

{ name: "Ronaldinho", country: "Brazil", club: "Barcelona", position: "Winger", league: "Legends", hintLeague: "La Liga", age: 46, foot: "Right", isLegend: true },

{ name: "Ronaldo Nazario", country: "Brazil", club: "Real Madrid", position: "Forward", league: "Legends", hintLeague: "La Liga", age: 49, foot: "Right", isLegend: true },

{ name: "Andrea Pirlo", country: "Italy", club: "AC Milan", position: "Midfielder", league: "Legends", hintLeague: "Serie A", age: 47, foot: "Right", isLegend: true },

{ name: "Xavi Hernandez", country: "Spain", club: "Barcelona", position: "Midfielder", league: "Legends", hintLeague: "La Liga", age: 46, foot: "Right", isLegend: true },

{ name: "Andres Iniesta", country: "Spain", club: "Barcelona", position: "Midfielder", league: "Legends", hintLeague: "La Liga", age: 42, foot: "Right", isLegend: true },

{ name: "Francesco Totti", country: "Italy", club: "Roma", position: "Forward", league: "Legends", hintLeague: "Serie A", age: 49, foot: "Right", isLegend: true },

{ name: "Paolo Maldini", country: "Italy", club: "AC Milan", position: "Defender", league: "Legends", hintLeague: "Serie A", age: 58, foot: "Left", isLegend: true },

{ name: "Thierry Henry", country: "France", club: "Arsenal", position: "Forward", league: "Legends", hintLeague: "Premier League", age: 49, foot: "Right", isLegend: true },

{ name: "Ryan Giggs", country: "Wales", club: "Manchester United", position: "Winger", league: "Legends", hintLeague: "Premier League", age: 52, foot: "Left", isLegend: true },

{ name: "Didier Drogba", country: "Ivory Coast", club: "Chelsea", position: "Forward", league: "Legends", hintLeague: "Premier League", age: 47, foot: "Right", isLegend: true },

{ name: "Frank Lampard", country: "England", club: "Chelsea", position: "Midfielder", league: "Legends", hintLeague: "Premier League", age: 48, foot: "Right", isLegend: true },

{ name: "Steven Gerrard", country: "England", club: "Liverpool", position: "Midfielder", league: "Legends", hintLeague: "Premier League", age: 46, foot: "Right", isLegend: true },

{ name: "Kaka", country: "Brazil", club: "AC Milan", position: "Midfielder", league: "Legends", hintLeague: "Serie A", age: 44, foot: "Right", isLegend: true },

{ name: "Wayne Rooney", country: "England", club: "Manchester United", position: "Forward", league: "Legends", hintLeague: "Premier League", age: 40, foot: "Right", isLegend: true },

{ name: "Alessandro Del Piero", country: "Italy", club: "Juventus", position: "Forward", league: "Legends", hintLeague: "Serie A", age: 51, foot: "Left", isLegend: true },

{ name: "Roberto Carlos", country: "Brazil", club: "Real Madrid", position: "Defender", league: "Legends", hintLeague: "La Liga", age: 53, foot: "Left", isLegend: true },

{ name: "Samuel Eto'o", country: "Cameroon", club: "Barcelona", position: "Forward", league: "Legends", hintLeague: "La Liga", age: 44, foot: "Right", isLegend: true },

{ name: "Iker Casillas", country: "Spain", club: "Real Madrid", position: "Goalkeeper", league: "Legends", hintLeague: "La Liga", age: 44, foot: "Right", isLegend: true },

];

// ==========================================
// COUNTRY FLAGS
// ==========================================

const countryFlags = {
    "England": "gb-eng",
    "France": "fr",
    "Morocco": "ma",
    "Spain": "es",
    "Italy": "it",
    "Japan": "jp",
    "Brazil": "br",
    "Argentina": "ar",
    "Portugal": "pt",
    "Germany": "de",
    "Belgium": "be",
    "Netherlands": "nl",
    "Croatia": "hr",
    "Uruguay": "uy",
    "Colombia": "co",
    "Senegal": "sn",
    "Egypt": "eg",
    "Nigeria": "ng",
    "Cameroon": "cm",
    "Ghana": "gh",
    "Ivory Coast": "ci",
    "South Korea": "kr",
    "Norway": "no",
    "Sweden": "se",
    "Denmark": "dk",
    "Poland": "pl",
    "Serbia": "rs",
    "Scotland": "gb-sct",
    "Wales": "gb-wls",
    "Turkey": "tr",
    "Austria": "at",
    "Switzerland": "ch",
    "Canada": "ca",
    "United States": "us",
    "Algeria": "dz",
    "Georgia": "ge",
    "Guinea": "gn",
    "Gabon": "ga",
    "Slovenia": "si",
    "Ecuador": "ec",
};

function flagFor(country) {
    const code = countryFlags[country];

    if (!code) return "";

    return `<img 
        src="https://flagcdn.com/24x18/${code}.png" 
        alt="${country}" 
        class="country-flag"
    >`;
}


// ==========================================
// GAME VARIABLES
// ==========================================

let difficulty = "easy";
let secretPlayer = null;
let gameStartTime = null;

let attempts = 0;

const attemptsByDifficulty = {
    easy: 7,
    medium: 5,
    hard: 3,
    legends: 4,
    daily: 6
};

const hintsByDifficulty = {
    easy: 4,
    medium: 3,
    hard: 2,
    legends: 2,
    daily: 3
};

let maxAttempts = attemptsByDifficulty.easy;

let isDaily = false;
let hintsUsed = 0;
let maxHints = 0;
let guessHistory = [];

// ==========================================
// DIFFICULTY PLAYER POOLS
// ==========================================

function getPlayersForDifficulty() {

    if (difficulty === "easy") {

        return players.filter(player => [

            "Kylian Mbappe",
            "Vinicius Junior",
            "Jude Bellingham",
            "Lamine Yamal",
            "Erling Haaland",
            "Mohamed Salah",
            "Harry Kane",
            "Robert Lewandowski",
            "Cristiano Ronaldo",
            "Lionel Messi",
            "Neymar Jr",
            "Kevin De Bruyne",
            "Luka Modric",
            "Son Heung-min"

        ].includes(player.name));

    }


    if (difficulty === "medium") {

        return players.filter(player => [

            "Rodrygo",
            "Federico Valverde",
            "Pedri",
            "Raphinha",
            "Frenkie de Jong",
            "Phil Foden",
            "Bernardo Silva",
            "Bukayo Saka",
            "Bruno Fernandes",
            "Achraf Hakimi",
            "Jamal Musiala",
            "Rafael Leao",
            "Antoine Griezmann",
            "Marcus Rashford",
            "Alexander Isak",
            "Florian Wirtz",
            "Victor Osimhen",
            "William Saliba",
            "Joshua Kimmich",
            "Joao Cancelo",
            "Randal Kolo Muani",
            "Viktor Gyokeres",
            "Federico Chiesa",
            "Cole Palmer",
            "Kaoru Mitoma",
            "Ruben Dias",
            "Vitinha",
            "Theo Hernandez",
            "Riyad Mahrez",
            "Sadio Mane",
            "Marc-Andre ter Stegen",
            "Gianluigi Donnarumma",
            "Ollie Watkins"

        ].includes(player.name));

    }


    if (difficulty === "legends") {

        return players.filter(player => player.isLegend);

    }


    // HARD

    return players.filter(player => !player.isLegend);

}


// ==========================================
// START GAME
// ==========================================

function startGame(selectedDifficulty) {

    difficulty = selectedDifficulty;

    isDaily = false;

    maxAttempts = attemptsByDifficulty[difficulty];

    const availablePlayers = getPlayersForDifficulty();

    secretPlayer =
        availablePlayers[
            Math.floor(Math.random() * availablePlayers.length)
        ];

    setupGameScreen();

}


// ==========================================
// DAILY CHALLENGE
// ==========================================

function hashCode(str) {

    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);

}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function getDailyPlayer() {

    const index = hashCode(todayKey()) % players.length;

    return players[index];

}

function startDaily() {

    const alreadyDone =
        localStorage.getItem("dailyDate") === todayKey();

    if (alreadyDone) {

        const won =
            localStorage.getItem("dailyWon") === "true";

        openDailyStatusModal(won);

        return;

    }

    difficulty = "daily";

    isDaily = true;

    maxAttempts = attemptsByDifficulty.daily;

    secretPlayer = getDailyPlayer();

    setupGameScreen();

}


// ==========================================
// SHARED GAME SCREEN SETUP
// ==========================================

function setupGameScreen() {

    attempts = 0;

    gameStartTime = Date.now();

    hintsUsed = 0;
    maxHints = hintsByDifficulty[difficulty] || 0;

    guessHistory = [];

    document.getElementById("menuScreen").classList.remove("active");

    document.getElementById("difficultyScreen").classList.remove("active");

    document.getElementById("statsScreen").classList.remove("active");

    document.getElementById("gameScreen").classList.add("active");

        document.getElementById("difficultyLabel").textContent =
        isDaily ? t("dailyLabel") : t(difficulty);

    document.getElementById("attemptsLeft").textContent = maxAttempts;

    document.getElementById("guesses").innerHTML = "";

    document.getElementById("message").textContent = "";

    document.getElementById("playerInput").value = "";

    document.getElementById("playerInput").disabled = false;

    const hintBtn = document.getElementById("hintButton");
    if (hintBtn) {
        if (maxHints > 0) {
            hintBtn.disabled = false;
            hintBtn.textContent = `💡 HINT (${maxHints})`;
            hintBtn.style.display = "";
        } else {
            hintBtn.style.display = "none";
        }
    }

    const hintText = document.getElementById("hintText");
    if (hintText) hintText.textContent = "";

    const shareBtn = document.getElementById("shareButton");
    if (shareBtn) shareBtn.style.display = "none";

    const giveUpBtn = document.querySelector(".action-button.giveup");
    if (giveUpBtn) giveUpBtn.style.display = "";

    const mpRoundInfo = document.getElementById("mpRoundInfo");
    if (mpRoundInfo) mpRoundInfo.style.display = "none";

    const opponentsPanel = document.getElementById("opponentsPanel");
    if (opponentsPanel) opponentsPanel.style.display = "none";

    activeSuggestionIndex = -1;

    updateProgressBar();

    if (typeof applyLanguage === "function") applyLanguage();

}


// ==========================================
// SHOW DIFFICULTY
// ==========================================

function showDifficulty() {

    document.getElementById("menuScreen").classList.remove("active");

    document.getElementById("statsScreen").classList.remove("active");

    document.getElementById("difficultyScreen").classList.add("active");

}


// ==========================================
// BACK TO MENU
// ==========================================

function backToMenu() {

    if (typeof mp !== "undefined" && mp.active) {
        mpTeardownChannel();
        resetMpState();
    }

    document.getElementById("multiplayerScreen").classList.remove("active");
    document.getElementById("createPartyScreen").classList.remove("active");
    document.getElementById("joinPartyScreen").classList.remove("active");
    document.getElementById("partyLobbyScreen").classList.remove("active");
    document.getElementById("difficultyScreen").classList.remove("active");

    document.getElementById("gameScreen").classList.remove("active");

    document.getElementById("statsScreen").classList.remove("active");

    document.getElementById("menuScreen").classList.add("active");

    updateDailyBadge();

}


// ==========================================
// HOW TO PLAY MODAL
// ==========================================

function openHowToPlay() {

    const modal = document.getElementById("howToPlayModal");

    if (!modal) return;

    modal.style.display = "block";

    modal.classList.add("open");

}

function closeHowToPlay(event) {

    const modal = document.getElementById("howToPlayModal");

    if (!modal) return;

    if (event.target === modal || event.target.classList.contains("modal-close")) {
        modal.classList.remove("open");
        modal.style.display = "none";
    }

}


// ==========================================
// DAILY STATUS MODAL
// ==========================================
// Shown when the player taps "Daily Challenge" after already
// having played today — replaces the old blocking alert() and
// the permanent "Today's challenge solved!" label under the button.

function openDailyStatusModal(won) {

    const modal = document.getElementById("dailyStatusModal");

    if (!modal) return;

    const icon = document.getElementById("dailyStatusIcon");
    const title = document.getElementById("dailyStatusTitle");
    const message = document.getElementById("dailyStatusMessage");

    if (icon) {
        icon.textContent = won ? "✅" : "❌";
    }

    if (title) {
        title.textContent = t("daily");
    }

    if (message) {
        message.textContent = t("alreadyPlayed");
    }

    modal.style.display = "block";
    modal.classList.add("open");

}

function closeDailyStatusModal(event) {

    const modal = document.getElementById("dailyStatusModal");

    if (!modal) return;

    if (
        !event ||
        event.target === modal ||
        event.target.classList.contains("modal-close") ||
        event.target.classList.contains("daily-status-ok")
    ) {
        modal.classList.remove("open");
        modal.style.display = "none";
    }

}


// ==========================================
// SETTINGS MODAL
// ==========================================

const HAPTICS_SUPPORTED = "vibrate" in navigator;
let hapticsEnabled = localStorage.getItem("hapticsEnabled") !== "false";

function hapticPulse(pattern) {
    if (HAPTICS_SUPPORTED && hapticsEnabled) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // ignore — haptics are a bonus, never critical
        }
    }
}

function openSettingsModal() {

    const modal = document.getElementById("settingsModal");

    if (!modal) return;

    syncSettingsUI();
    applySettingsLanguage();

    modal.style.display = "block";
    modal.classList.add("open");

}

function closeSettingsModal(event) {

    const modal = document.getElementById("settingsModal");

    if (!modal) return;

    if (
        !event ||
        event.target === modal ||
        event.target.classList.contains("modal-close")
    ) {
        modal.classList.remove("open");
        modal.style.display = "none";
        resetProgressConfirmState();
    }

}

// ------------------------------------------
// VOLUME SLIDER FILL
// (Chrome/Safari don't fill the track natively
// like Firefox's ::-moz-range-progress does, so
// we paint it ourselves with a background gradient)
// ------------------------------------------

function updateSliderFill(slider) {

    if (!slider) return;

    const min = Number(slider.min) || 0;
    const max = Number(slider.max) || 100;
    const val = Number(slider.value);

    const percent = ((val - min) / (max - min)) * 100;

    slider.style.background =
        `linear-gradient(to right,
            rgb(var(--row-accent-rgb, 61, 139, 253)) 0%,
            rgb(var(--row-accent-rgb, 61, 139, 253)) ${percent}%,
            rgba(255, 255, 255, 0.08) ${percent}%,
            rgba(255, 255, 255, 0.08) 100%)`;

}


function syncSettingsUI() {

    const bgmToggle = document.getElementById("bgmToggle");
    const bgmSlider = document.getElementById("bgmVolumeSlider");
    const sfxToggle = document.getElementById("sfxToggle");
    const sfxSlider = document.getElementById("sfxVolumeSlider");
    const hapticsToggle = document.getElementById("hapticsToggle");
    const hapticsGroup = document.getElementById("hapticsGroup");

    if (bgmToggle) bgmToggle.checked = !bgmMuted;

    if (bgmSlider) {
        bgmSlider.value = bgmVolume;
        bgmSlider.disabled = bgmMuted;
        updateSliderFill(bgmSlider);
    }

    if (sfxToggle) sfxToggle.checked = !sfxMuted;

    if (sfxSlider) {
        sfxSlider.value = sfxVolume;
        sfxSlider.disabled = sfxMuted;
        updateSliderFill(sfxSlider);
    }

    if (hapticsToggle) hapticsToggle.checked = hapticsEnabled;

    if (hapticsGroup) {
        hapticsGroup.style.display = HAPTICS_SUPPORTED ? "flex" : "none";
    }

}

function toggleBgm(enabled) {

    bgmMuted = !enabled;

    localStorage.setItem("bgmMuted", bgmMuted);

    const slider = document.getElementById("bgmVolumeSlider");
    if (slider) slider.disabled = bgmMuted;

    if (bgmMuted) {
        stopBGM();
    } else {
        startBGM();
    }

}

function setBgmVolume(value) {

    bgmVolume = Number(value);

    localStorage.setItem("bgmVolume", bgmVolume);

    updateBgmGain();

    updateSliderFill(document.getElementById("bgmVolumeSlider"));

}

function toggleSfx(enabled) {

    sfxMuted = !enabled;

    localStorage.setItem("sfxMuted", sfxMuted);

    const slider = document.getElementById("sfxVolumeSlider");
    if (slider) slider.disabled = sfxMuted;

    if (!sfxMuted) sfxClick();

}

function setSfxVolume(value) {

    sfxVolume = Number(value);

    localStorage.setItem("sfxVolume", sfxVolume);

    updateSliderFill(document.getElementById("sfxVolumeSlider"));

}

function toggleHaptics(enabled) {

    hapticsEnabled = enabled;

    localStorage.setItem("hapticsEnabled", enabled);

    if (enabled) hapticPulse(15);

}

let resetConfirmTimeout = null;

function handleResetProgressClick() {

    const btn = document.getElementById("resetProgressButton");

    if (!btn) return;

    if (!btn.classList.contains("confirming")) {

        btn.classList.add("confirming");
        btn.textContent = t("settingsResetConfirm");

        resetConfirmTimeout = setTimeout(resetProgressConfirmState, 4000);

        return;

    }

    clearTimeout(resetConfirmTimeout);
    resetProgress();
    resetProgressConfirmState();
    closeSettingsModal();

}

function resetProgressConfirmState() {

    const btn = document.getElementById("resetProgressButton");

    if (!btn) return;

    btn.classList.remove("confirming");
    btn.textContent = t("settingsReset");

    if (resetConfirmTimeout) {
        clearTimeout(resetConfirmTimeout);
        resetConfirmTimeout = null;
    }

}

function resetProgress() {

    [
        "gamesPlayed",
        "gamesWon",
        "streak",
        "dailyStreak",
        "dailyDate",
        "dailyWon",
        "achievements"
    ].forEach(key => localStorage.removeItem(key));

    updateStats();
    updateDailyBadge();
    renderAchievements();

}


// ==========================================
// DAILY BADGE
// ==========================================

function updateDailyBadge() {

    // The result is now shown in a modal when the player taps the
    // Daily Challenge button (see openDailyStatusModal), so this
    // element is kept empty rather than showing a persistent label.

    const badge = document.getElementById("dailyStatus");

    if (!badge) return;

    badge.textContent = "";

}


// ==========================================
// STATS
// ==========================================

function showStats() {

    document.getElementById("menuScreen").classList.remove("active");

    document.getElementById("statsScreen").classList.add("active");

    updateStats();

}


function updateStats() {

    const gamesPlayed =
        Number(localStorage.getItem("gamesPlayed")) || 0;

    const gamesWon =
        Number(localStorage.getItem("gamesWon")) || 0;

    const streak =
        Number(localStorage.getItem("streak")) || 0;

    const winRate =
        gamesPlayed === 0
            ? 0
            : Math.round((gamesWon / gamesPlayed) * 100);

    document.getElementById("gamesPlayed").textContent =
        gamesPlayed;

    document.getElementById("gamesWon").textContent =
        gamesWon;

    document.getElementById("winRate").textContent =
        winRate + "%";

    document.getElementById("currentStreak").textContent =
        streak;

    const dailyStreak =
        Number(localStorage.getItem("dailyStreak")) || 0;

    const dailyStreakEl = document.getElementById("dailyStreak");

    if (dailyStreakEl) dailyStreakEl.textContent = dailyStreak;

    renderAchievements();

}


// ==========================================
// PLAYER SEARCH
// ==========================================

const input =
    document.getElementById("playerInput");

const suggestions =
    document.getElementById("suggestions");

let activeSuggestionIndex = -1;


function highlightMatch(name, search) {

    const idx = name.toLowerCase().indexOf(search);

    if (idx === -1) return name;

    return (
        name.slice(0, idx) +
        `<mark>${name.slice(idx, idx + search.length)}</mark>` +
        name.slice(idx + search.length)
    );

}


input.addEventListener("input", function () {

    const search =
        input.value.toLowerCase().trim();

    suggestions.innerHTML = "";

    activeSuggestionIndex = -1;

    if (search === "") {
        return;
    }

    const matches =
        players
            .filter(player =>
                player.name
                    .toLowerCase()
                    .includes(search)
            )
            .slice(0, 6);


    matches.forEach(player => {

        const div =
            document.createElement("div");

        div.className = "suggestion";

        div.innerHTML = highlightMatch(player.name, search);

        div.onclick = function () {

            input.value = player.name;

            suggestions.innerHTML = "";

            sfxSelect();

            input.focus();

        };

        suggestions.appendChild(div);

    });

});


function highlightSuggestion(index) {

    const items = suggestions.querySelectorAll(".suggestion");

    items.forEach(el => el.classList.remove("highlighted"));

    if (items[index]) {
        items[index].classList.add("highlighted");
        items[index].scrollIntoView({ block: "nearest" });
    }

}


// ==========================================
// GUESS
// ==========================================

function guessPlayer() {

    if (typeof mp !== "undefined" && mp.active) {
        mpSubmitGuess();
        return;
    }

    if (!secretPlayer) {
        return;
    }

    if (attempts >= maxAttempts) {
        return;
    }

    const playerName =
        input.value.trim();


    const guessedPlayer =
        players.find(
            player =>
                player.name.toLowerCase() ===
                playerName.toLowerCase()
        );


    if (!guessedPlayer) {

        showMessage(t("chooseSuggestion"));

        return;
    }


    attempts++;

    suggestions.innerHTML = "";

    createGuessRow(guessedPlayer);

    input.value = "";

    document.getElementById("attemptsLeft").textContent =
        maxAttempts - attempts;

    updateProgressBar();


    // ======================================
    // WIN
    // ======================================

    if (
        guessedPlayer.name ===
        secretPlayer.name
    ) {

        showMessage(
            t("amazing", { player: secretPlayer.name })
        );

        input.disabled = true;

        recordGame(true);

        launchConfetti();

        sfxWin();

        hapticPulse([20, 40, 20]);

        showShareButton();

        const rows = document.querySelectorAll("#guesses .guess-row");

        if (rows.length) {
            rows[rows.length - 1].classList.add("winning-row");
        }

        return;
    }


    // ======================================
    // LOSE
    // ======================================

    if (attempts >= maxAttempts) {

        showMessage(
            t("gameOver", { player: secretPlayer.name })
        );

        input.disabled = true;

        revealSecretPlayerRow();

        recordGame(false);

        sfxLose();

        hapticPulse(60);

        showShareButton();

        return;

    }

    showMessage(
        t("notThisOne", { amount: maxAttempts - attempts })
    );

    sfxWrong();

    shakeMessage();

}


// ==========================================
// CREATE GUESS ROW
// ==========================================

function createGuessRow(player) {

    const container =
        document.getElementById("guesses");


    const row =
        document.createElement("div");

    row.className = "guess-row";


    // PLAYER

    row.appendChild(
        createCell(
            player.name,
            "guess-cell"
        )
    );


    // COUNTRY

    const countryStatus =
        player.country === secretPlayer.country
            ? "correct"
            : "wrong";

    row.appendChild(
        createCell(
            player.country,
            countryStatus,
            flagFor(player.country)
        )
    );


    // CLUB

    const clubStatus =
        player.club === secretPlayer.club
            ? "correct"
            : "wrong";

    row.appendChild(
        createCell(
            player.club,
            clubStatus
        )
    );


    // LEAGUE

    const leagueStatus =
        player.league === secretPlayer.league
            ? "correct"
            : "wrong";

    row.appendChild(
        createCell(
            player.league,
            leagueStatus
        )
    );


    // POSITION

    const positionStatus =
        player.position === secretPlayer.position
            ? "correct"
            : "wrong";

    row.appendChild(
        createCell(
            player.position,
            positionStatus
        )
    );


    // AGE

    let ageClass = "wrong";

    let ageArrow = "";


    if (player.age === secretPlayer.age) {

        ageClass = "correct";

    } else {

        ageClass =
            Math.abs(
                player.age - secretPlayer.age
            ) <= 2
                ? "close"
                : "wrong";


        ageArrow =
            player.age < secretPlayer.age
                ? " ⬆️"
                : " ⬇️";

    }


    row.appendChild(
        createCell(
            player.age + ageArrow,
            ageClass
        )
    );


    // FOOT

    const footStatus =
        player.foot === secretPlayer.foot
            ? "correct"
            : "wrong";

    row.appendChild(
        createCell(
            player.foot,
            footStatus
        )
    );


    container.appendChild(row);

    guessHistory.push([
        countryStatus,
        clubStatus,
        leagueStatus,
        positionStatus,
        ageClass,
        footStatus
    ]);

    playCellCascade([
        countryStatus,
        clubStatus,
        leagueStatus,
        positionStatus,
        ageClass,
        footStatus
    ]);

}

function playCellCascade(statuses) {

    statuses.forEach((status, i) => {

        const delay = i * 0.06;

        if (status === "correct") {
            playTone(880, delay, 0.1, "triangle", 0.1);
        } else if (status === "close") {
            playTone(600, delay, 0.08, "triangle", 0.08);
        }

    });

    if (statuses.includes("correct")) {
        hapticPulse(12);
    }

}


// ==========================================
// CREATE CELL
// ==========================================

function createCell(text, className, flagHtml) {

    const cell =
        document.createElement("div");

    cell.className =
        `guess-cell ${className}`;

    if (flagHtml) {
        cell.insertAdjacentHTML("beforeend", flagHtml);
    }

    cell.appendChild(
        document.createTextNode(text)
    );

    return cell;

}


// ==========================================
// MESSAGE
// ==========================================

function showMessage(message) {

    document.getElementById("message").textContent =
        message;

}


// ==========================================
// SAVE STATS
// ==========================================

function recordGame(won) {

    let gamesPlayed =
        Number(localStorage.getItem("gamesPlayed")) || 0;

    let gamesWon =
        Number(localStorage.getItem("gamesWon")) || 0;

    let streak =
        Number(localStorage.getItem("streak")) || 0;


    gamesPlayed++;


    if (won) {

        gamesWon++;

        streak++;

    } else {

        streak = 0;

    }


    localStorage.setItem(
        "gamesPlayed",
        gamesPlayed
    );

    localStorage.setItem(
        "gamesWon",
        gamesWon
    );

    localStorage.setItem(
        "streak",
        streak
    );

    let dailyStreak =
        Number(localStorage.getItem("dailyStreak")) || 0;

    if (isDaily) {

        localStorage.setItem("dailyDate", todayKey());

        localStorage.setItem("dailyWon", won ? "true" : "false");

        dailyStreak = won ? dailyStreak + 1 : 0;

        localStorage.setItem("dailyStreak", dailyStreak);

    }

    checkAchievements({
        won,
        gamesWon,
        streak,
        dailyStreak
    });

    if (won) {
        const elapsedSeconds = gameStartTime
            ? Math.round((Date.now() - gameStartTime) / 1000)
            : null;

        recordLeaderboardEntry(attempts, difficulty, elapsedSeconds);
    }

}


// ==========================================
// ACHIEVEMENTS
// ==========================================

const ACHIEVEMENTS = [
    {
        id: "first_win",
        icon: "🥇",
        name: "First Blood",
        desc: "Win your first game",
        check: s => s.won && s.gamesWon === 1
    },
    {
        id: "flawless",
        icon: "⚡",
        name: "Flawless Victory",
        desc: "Win in a single guess",
        check: s => s.won && attempts === 1
    },
    {
        id: "clutch",
        icon: "😅",
        name: "Clutch Save",
        desc: "Win on your very last attempt",
        check: s => s.won && attempts === maxAttempts
    },
    {
        id: "hard_hero",
        icon: "🔴",
        name: "Hard Mode Hero",
        desc: "Win on Hard difficulty",
        check: s => s.won && difficulty === "hard"
    },
    {
        id: "legend_master",
        icon: "🟣",
        name: "Legend Master",
        desc: "Win on Legends difficulty",
        check: s => s.won && difficulty === "legends"
    },
    {
        id: "sharp_mind",
        icon: "🧠",
        name: "Sharp Mind",
        desc: "Win without using a hint",
        check: s => s.won && hintsUsed === 0
    },
    {
        id: "daily_3",
        icon: "🔥",
        name: "Daily Devotee",
        desc: "3-day Daily Challenge streak",
        check: s => s.dailyStreak >= 3
    },
    {
        id: "streak_5",
        icon: "🚀",
        name: "On Fire",
        desc: "5-game win streak",
        check: s => s.streak >= 5
    },
    {
        id: "quickfire",
        icon: "💨",
        name: "Quickfire",
        desc: "Win in 2 guesses or fewer",
        check: s => s.won && attempts <= 2
    },
    {
        id: "iron_will",
        icon: "⚔️",
        name: "Iron Will",
        desc: "Win on Legends difficulty without using a hint",
        check: s => s.won && difficulty === "legends" && hintsUsed === 0
    },
    {
        id: "nine_lives",
        icon: "🐈‍⬛",
        name: "Nine Lives",
        desc: "Win on Hard difficulty on your very last attempt",
        check: s => s.won && difficulty === "hard" && attempts === maxAttempts
    },
    {
        id: "grandmaster",
        icon: "🏆",
        name: "Grandmaster",
        desc: "Guess a Legend correctly on your first try",
        check: s => s.won && difficulty === "legends" && attempts === 1
    },
    {
        id: "streak_10",
        icon: "👑",
        name: "Unstoppable",
        desc: "10-game win streak",
        check: s => s.streak >= 10
    },
    {
        id: "streak_20",
        icon: "🌋",
        name: "Unbreakable",
        desc: "20-game win streak",
        check: s => s.streak >= 20
    },
    {
        id: "daily_7",
        icon: "📅",
        name: "Perfect Week",
        desc: "7-day Daily Challenge streak",
        check: s => s.dailyStreak >= 7
    },
    {
        id: "daily_30",
        icon: "🗓️",
        name: "Calendar Crusher",
        desc: "30-day Daily Challenge streak",
        check: s => s.dailyStreak >= 30
    },
    {
        id: "veteran",
        icon: "🎖️",
        name: "Veteran",
        desc: "Win 50 games total",
        check: s => s.gamesWon >= 50
    },
    {
        id: "century",
        icon: "💯",
        name: "Century Club",
        desc: "Win 100 games total",
        check: s => s.gamesWon >= 100
    }
];

function getUnlockedAchievements() {

    try {
        return JSON.parse(localStorage.getItem("achievements")) || [];
    } catch (e) {
        return [];
    }

}

function checkAchievements(state) {

    const unlocked = getUnlockedAchievements();

    ACHIEVEMENTS.forEach(a => {

        if (unlocked.includes(a.id)) return;

        if (a.check(state)) {
            unlocked.push(a.id);
            showAchievementToast(a);
        }

    });

    localStorage.setItem("achievements", JSON.stringify(unlocked));

}

function showAchievementToast(achievement) {

    const toast = document.createElement("div");

    toast.className = "achievement-toast";

    toast.innerHTML =
        `<span class="achievement-icon">${achievement.icon}</span>
         <div>
            <strong>Achievement Unlocked</strong>
            <div>${achievement.name}</div>
         </div>`;

    document.body.appendChild(toast);

    sfxHint();

    setTimeout(() => toast.classList.add("show"), 50);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3200);

}

function renderAchievements() {

    const grid = document.getElementById("achievementsGrid");

    if (!grid) return;

    const unlocked = getUnlockedAchievements();

    grid.innerHTML = "";

    ACHIEVEMENTS.forEach(a => {

        const isUnlocked = unlocked.includes(a.id);

        const card = document.createElement("div");

        card.className = "badge" + (isUnlocked ? " unlocked" : "");

        const detailText = isUnlocked ? a.desc : "Locked — " + a.desc;

        card.title = detailText;

        card.innerHTML =
            `<span class="badge-icon">${a.icon}</span><span class="badge-name">${a.name}</span>`;

        card.addEventListener("click", () => {
            showAchievementDetail(a.icon, a.name, detailText);
        });

        grid.appendChild(card);

    });

}


// ==========================================
// ACHIEVEMENT DETAIL MODAL
// ==========================================

function showAchievementDetail(icon, name, detailText) {

    let overlay = document.getElementById("achievementDetailOverlay");

    if (!overlay) {

        overlay = document.createElement("div");
        overlay.id = "achievementDetailOverlay";
        overlay.className = "achievement-detail-overlay";

        overlay.innerHTML = `
            <div class="achievement-detail-card">
                <button class="achievement-detail-close" aria-label="Close">✕</button>
                <span class="achievement-detail-icon"></span>
                <div class="achievement-detail-name"></div>
                <div class="achievement-detail-desc"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay || e.target.classList.contains("achievement-detail-close")) {
                overlay.classList.remove("show");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") overlay.classList.remove("show");
        });

    }

    overlay.querySelector(".achievement-detail-icon").textContent = icon;
    overlay.querySelector(".achievement-detail-name").textContent = name;
    overlay.querySelector(".achievement-detail-desc").textContent = detailText;

    overlay.classList.add("show");

}


const achievementDetailStyle = document.createElement("style");

achievementDetailStyle.textContent = `
    .achievement-detail-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 300;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }

    .achievement-detail-overlay.show {
        display: flex;
    }

    .achievement-detail-card {
        position: relative;
        background: rgba(16, 23, 34, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 36px 28px 28px;
        max-width: 320px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .achievement-detail-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.08);
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: 0.2s ease;
    }

    .achievement-detail-close:hover {
        background: rgba(255, 255, 255, 0.18);
    }

    .achievement-detail-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 14px;
    }

    .achievement-detail-name {
        font-size: 20px;
        font-weight: 700;
        color: white;
        margin-bottom: 10px;
    }

    .achievement-detail-desc {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.4;
    }
`;

document.head.appendChild(achievementDetailStyle);


// ==========================================
// ENTER KEY
// ==========================================

// ==========================================
// KEYBOARD NAVIGATION
// ==========================================

input.addEventListener(
    "keydown",
    function(event) {

        const items = suggestions.querySelectorAll(".suggestion");

        if (event.key === "ArrowDown" && items.length) {

            event.preventDefault();

            activeSuggestionIndex =
                (activeSuggestionIndex + 1) % items.length;

            highlightSuggestion(activeSuggestionIndex);

            return;

        }

        if (event.key === "ArrowUp" && items.length) {

            event.preventDefault();

            activeSuggestionIndex =
                (activeSuggestionIndex - 1 + items.length) % items.length;

            highlightSuggestion(activeSuggestionIndex);

            return;

        }

        if (event.key === "Escape") {

            suggestions.innerHTML = "";

            activeSuggestionIndex = -1;

            return;

        }

        if (event.key === "Enter") {

            if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {

                input.value = items[activeSuggestionIndex].textContent;

                suggestions.innerHTML = "";

                activeSuggestionIndex = -1;

                sfxSelect();

                return;

            }

            guessPlayer();

        }

    }
);


// ==========================================
// PROGRESS BAR
// ==========================================

function updateProgressBar() {

    const fill = document.getElementById("progressFill");

    if (!fill) return;

    const remaining = maxAttempts - attempts;

    const pct = Math.max(0, (remaining / maxAttempts) * 100);

    fill.style.width = pct + "%";

    fill.classList.remove("progress-danger", "progress-warning");

    if (pct <= 33) {
        fill.classList.add("progress-danger");
    } else if (pct <= 66) {
        fill.classList.add("progress-warning");
    }

}


// ==========================================
// HINT
// ==========================================

function useHint() {

    if (!secretPlayer || input.disabled) return;
    if (hintsUsed >= maxHints) return;

    hintsUsed++;

    sfxHint();

    updateHintDisplay();
    updateHintButton();

}

function updateHintDisplay() {

    const hintText = document.getElementById("hintText");
    if (!hintText || !secretPlayer) return;

    const verbKey = secretPlayer.isLegend ? "hintLegend" : "hintNormal";
    const leagueName = secretPlayer.hintLeague || secretPlayer.league;

    let html = t(verbKey, {
        flag: flagFor(secretPlayer.country),
        country: secretPlayer.country,
        league: leagueName
    });

    if (hintsUsed >= 2) {
        const clubVerb = secretPlayer.isLegend
            ? t("hintUsedToPlayFor")
            : t("hintPlaysFor");
        html += `<br>🏟️ ${clubVerb} ${secretPlayer.club}`;
    }

    if (hintsUsed >= 3) {
        html += `<br>📍 ${tPosition(secretPlayer.position)}`;
    }

    if (hintsUsed >= 4) {
        const footWord = t(secretPlayer.foot === "Left" ? "footLeft" : "footRight");
        html += `<br>🦶 ${t("hintFooted", { foot: footWord })}`;
    }

    hintText.innerHTML = html;

}

function updateHintButton() {

    const hintBtn = document.getElementById("hintButton");
    if (!hintBtn) return;

    const remaining = maxHints - hintsUsed;

    if (remaining <= 0) {
        hintBtn.disabled = true;
        hintBtn.textContent = "💡 USED";
    } else {
        hintBtn.disabled = input.disabled;
        hintBtn.textContent = `💡 HINT (${remaining})`;
    }

}

// ==========================================
// REVEAL THE ANSWER ROW (single player)
// ==========================================

function revealSecretPlayerRow() {

    if (!secretPlayer) return;

    const container = document.getElementById("guesses");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "guess-row reveal-row";

    // Player name — always "correct"
    row.appendChild(createCell(secretPlayer.name, "guess-cell"));

    // Country
    row.appendChild(
        createCell(
            secretPlayer.country,
            "correct",
            flagFor(secretPlayer.country)
        )
    );

    // Club
    row.appendChild(createCell(secretPlayer.club, "correct"));

    // League
    row.appendChild(createCell(secretPlayer.league, "correct"));

    // Position — localized
    row.appendChild(createCell(tPosition(secretPlayer.position), "correct"));

    // Age
    row.appendChild(createCell(secretPlayer.age, "correct"));

    // Foot
    row.appendChild(createCell(secretPlayer.foot, "correct"));

    container.appendChild(row);

    playCellCascade(["correct", "correct", "correct", "correct", "correct", "correct"]);

}

// ==========================================
// GIVE UP
// ==========================================

function giveUp() {

    if (!secretPlayer || input.disabled) return;

    showMessage(
        t("gaveUp", { player: secretPlayer.name })
    );

    input.disabled = true;

    recordGame(false);

    sfxLose();

    hapticPulse(60);

    showShareButton();

}


// ==========================================
// SHAKE ANIMATION
// ==========================================

function shakeMessage() {

    const msg = document.getElementById("message");

    if (!msg) return;

    msg.classList.remove("shake");

    void msg.offsetWidth;

    msg.classList.add("shake");

}


// ==========================================
// CONFETTI
// ==========================================

function launchConfetti() {

    const colors = ["#3d8bfd", "#18a957", "#d49a18", "#b83245", "#ffffff"];

    for (let i = 0; i < 60; i++) {

        const piece = document.createElement("div");

        piece.className = "confetti-piece";

        piece.style.left = Math.random() * 100 + "vw";

        piece.style.background =
            colors[Math.floor(Math.random() * colors.length)];

        piece.style.animationDuration = 2.5 + Math.random() * 1.5 + "s";

        piece.style.animationDelay = Math.random() * 0.3 + "s";

        piece.style.transform =
            `rotate(${Math.random() * 360}deg)`;

        document.body.appendChild(piece);

        setTimeout(() => piece.remove(), 4500);

    }

}


// ==========================================
// SHARE RESULTS
// ==========================================

function showShareButton() {

    const shareBtn = document.getElementById("shareButton");

    if (shareBtn) shareBtn.style.display = "inline-block";

}

function statusSquare(status) {

    if (status === "correct") return "🟩";

    if (status === "close") return "🟨";

    return "⬛";

}

function shareResults() {

    const label = isDaily ? "🔥 Daily Challenge" : difficulty.toUpperCase();

    const won = guessHistory.some(row =>
        row.every(status => status === "correct")
    );

    let text =
        `FOOTDLE — ${label}\n` +
        `${won ? attempts : "X"}/${maxAttempts} guesses\n\n`;

    guessHistory.forEach(row => {
        text += row.map(statusSquare).join("") + "\n";
    });

    text += "\nPlay at footballguessr.freehosting.dev";

    if (navigator.clipboard) {

        navigator.clipboard.writeText(text).then(() => {
            showMessage("📋 Results copied to clipboard!");
        }).catch(() => {
            showMessage(text);
        });

    } else {
        showMessage(text);
    }

}


// ==========================================
// INIT
// ==========================================

updateDailyBadge();

const howToPlayModalEl = document.getElementById("howToPlayModal");
if (howToPlayModalEl) howToPlayModalEl.style.display = "none";

const dailyStatusModalEl = document.getElementById("dailyStatusModal");
if (dailyStatusModalEl) dailyStatusModalEl.style.display = "none";

const settingsModalEl = document.getElementById("settingsModal");
if (settingsModalEl) settingsModalEl.style.display = "none";

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal-overlay.open").forEach(modal => {
            modal.classList.remove("open");
            modal.style.display = "none";
        });
        resetProgressConfirmState();
    }
});

// ==========================================
// GLOBAL CLICK SFX DISPATCHER
// ==========================================
// Priority order:
//   1. data-sfx="none"  → this button handles its own sound; do nothing
//   2. data-sfx="xxx"   → play that specific sound
//   3. .modal-close / .nickname-close / .leaderboard-close  → sfxClose
//   4. .back-button / .back-small  → sfxBack
//   5. default → sfxClick
// ==========================================

document.addEventListener("click", function (e) {

    const btn = e.target.closest("button");
    if (!btn) return;

    // 1. Explicit opt-out — button's own handler plays a specific sound
    if (btn.dataset.sfx === "none") return;

    // 2. Explicit sound override
    if (btn.dataset.sfx) {
        playSfx(btn.dataset.sfx);
        return;
    }

    // 3. Close buttons
    if (btn.classList.contains("modal-close") ||
        btn.classList.contains("nickname-close") ||
        btn.classList.contains("leaderboard-close")) {
        sfxClose();
        return;
    }

    // 4. Back buttons
    if (btn.classList.contains("back-button") ||
        btn.classList.contains("back-small")) {
        sfxBack();
        return;
    }

    // 5. Default
    sfxClick();

});

// ==========================================
// HOVER SFX
// ==========================================

let _lastHoverTime = 0;
const HOVER_THROTTLE_MS = 80;

document.addEventListener("mouseover", function (e) {

    // Ignore touch devices — no cursor, no hover
    if (window.matchMedia("(hover: none)").matches) return;

    const btn = e.target.closest(
        "button, .difficulty-card, .mp-pill, .badge"
    );
    if (!btn) return;

    // Moving between children of the same button — ignore
    if (btn.contains(e.relatedTarget)) return;

    // Throttle so fast mouse movement doesn't machine-gun
    const now = performance.now();
    if (now - _lastHoverTime < HOVER_THROTTLE_MS) return;
    _lastHoverTime = now;

    sfxHover();

});

// ==========================================
// LANGUAGE SYSTEM
// ==========================================

const FOOTDLE_LANGUAGES = {
    en: {
        name: "English",
        flag: "gb",

        tagline: "THE ULTIMATE FOOTBALL GUESSING GAME",
        play: "🎮 PLAY",
        daily: "🔥 DAILY CHALLENGE",
        stats: "📊 STATS",
        howToPlay: "❓ HOW TO PLAY",
        footer: "Guess the player. Master the game.",

        easy: "EASY",
        medium: "MEDIUM",
        hard: "HARD",
        legends: "LEGENDS",
        attempts: "attempts",

        dailyLabel: "🔥 DAILY",
        attemptsLeft: "attempts left",

        search: "Search for a footballer...",
        gameTitle: "WHO IS THE PLAYER?",
        gameSubtitle: "Guess the mystery footballer",
        backMenu: "← MENU",
        guess: "GUESS",
        hint: "💡 HINT",
        hintUsed: "💡 USED",
        giveUp: "🏳️ GIVE UP",
        share: "📋 SHARE RESULTS",

        player: "PLAYER",
        country: "COUNTRY",
        club: "CLUB",
        league: "LEAGUE",
        position: "POSITION",
        age: "AGE",
        foot: "FOOT",

        games: "Games",
        wins: "Wins",
        winRate: "Win Rate",
        streak: "Streak",
        dailyStreak: "Daily Streak",
        achievements: "Achievements",

        howTitle: "❓ HOW TO PLAY",
        how1: "Guess the mystery footballer using the search box — pick a name from the suggestions.",
        how2: "Each guess reveals clues: green = correct, yellow = close, red = wrong.",
        how3: "For age, an arrow shows whether the real player is older ⬆️ or younger ⬇️.",
        how4: "Pick a difficulty — more attempts on Easy, fewer as it gets harder.",
        how5: "🔥 Daily Challenge gives everyone the same mystery player once a day.",
        how6: "💡 Use one free Hint per game if you're stuck.",
        how7: "📋 Share your results as an emoji grid once the game ends.",
        how8: "🏆 Unlock Achievements for special ways of winning.",

        chooseSuggestion: "❌ Choose a footballer from the suggestions.",
        amazing: "🎉 AMAZING! You found {player}!",
        gameOver: "😢 Game over! The player was {player}.",
        notThisOne: "❌ Not this one! {amount} attempts remaining.",
        gaveUp: "🏳️ You gave up. The player was {player}.",
        copied: "📋 Results copied to clipboard!",

        dailySolved: "✅ Today's challenge solved!",
        dailyAttempted: "❌ Today's challenge attempted.",
        alreadyPlayed: "🔥 You already played today's Daily Challenge! Come back tomorrow for a new one.",

        hintNormal: "💡 This player is from {flag} {country} and plays in the {league}.",
        hintLegend: "💡 This player is from {flag} {country} and used to play in the {league}.",
        hintPlaysFor: "plays for",
        hintUsedToPlayFor: "used to play for",
        hintFooted: "{foot}-footed",
        footLeft: "left",
        footRight: "right",
        posGoalkeeper: "Goalkeeper",
        posDefender: "Defender",
        posMidfielder: "Midfielder",
        posWinger: "Winger",
        posForward: "Forward",

        achievementUnlocked: "Achievement Unlocked",
        locked: "Locked — ",

        // MULTIPLAYER
        mpMenuTitle: "👥 MULTIPLAYER",
        mpMenuSubtitle: "Race a friend to guess the mystery footballer first",
        mpCreateParty: "🎉 CREATE PARTY",
        mpJoinParty: "🔑 JOIN PARTY",
        mpBack: "← BACK",

        mpCreatePartyTitle: "🎉 CREATE PARTY",
        mpCreatePartySubtitle: "Set up the room for your party",
        mpDifficultyLabel: "DIFFICULTY",
        mpRoundsLabel: "ROUNDS",
        mpHintsLabel: "HINTS (per player, per round)",
        mpHintsOff: "🚫 Off",
        mpPrivacyLabel: "PRIVACY",
        mpPillEasy: "🟢 Easy",
        mpPillMedium: "🟡 Medium",
        mpPillHard: "🔴 Hard",
        mpPillLegends: "🟣 Legends",
        mpPublic: "🌐 Public",
        mpPrivate: "🔒 Private",
        mpPasswordPlaceholder: "Party password",
        mpCreateButton: "CREATE PARTY",
        mpErrorNickname: "Pick a nickname first.",
        mpErrorPassword: "Enter a password or switch to Public.",

        mpJoinPartyTitle: "🔑 JOIN PARTY",
        mpJoinPartySubtitle: "Enter the code your friend shared with you",
        mpPartyCodeLabel: "PARTY CODE",
        mpPasswordLabel: "PASSWORD (if private)",
        mpPasswordLeaveBlank: "Leave blank if public",
        mpJoinButton: "JOIN",
        mpErrorCode: "Enter the 5-character party code.",
        mpConnecting: "Connecting…",
        mpNoResponse: "No response from that party. Check the code and try again.",
        mpWrongPassword: "Wrong password.",
        mpAlreadyStarted: "That party's game already started.",
        mpCouldntJoin: "Couldn't join that party.",

        mpLobbyTitle: "🎉 PARTY LOBBY",
        mpCodeLabel: "CODE",
        mpCopyButton: "📋 COPY",
        mpCopied: "✅ COPIED",
        mpStartGame: "▶ START GAME",
        mpNeedTwoPlayers: "Need at least 2 players to start.",
        mpWaitingForHost: "Waiting for the host to start the game…",
        mpYouSuffix: " (you)",
        mpHostBadge: "HOST",
        mpLeaveParty: "← LEAVE PARTY",
        mpRoundWord: "round",
        mpRoundsWord: "rounds",

        mpRoundInfo: "ROUND {round} / {total}",
        mpHostDisconnected: "⚠️ The host disconnected.",
        mpFoundFirst: "🎉 AMAZING! You found {player} first!",
        mpOutOfAttempts: "⏳ Out of attempts — waiting for the others…",

        mpWonRound: "🎉 You won the round!",
        mpPlayerWonRound: "{nickname} won the round",
        mpNobodyGotIt: "Nobody got it!",
        mpPlayerWas: "The player was {player}.",
        mpFinalResultsComing: "Final results coming up…",
        mpRoundStartingSoon: "Round {round} starting soon…",
        mpPointSingular: "pt",
        mpPointPlural: "pts",
        mpPlayerDefaultName: "Player",

        mpPartyResults: "🏆 PARTY RESULTS",
        mpBackToMenu: "BACK TO MENU",
        mpRematch: "🔁 REMATCH",
        mpChangeSettings: "⚙️ CHANGE SETTINGS",
        mpRematchStatus: "{voted}/{total} ready — waiting…",
        mpSaveSettings: "💾 SAVE SETTINGS",
        mpHostChangingSettings: "⚙️ Host is changing the settings…",

        // LEADERBOARD
        lbMenuButton: "🏆 LEADERBOARD",
        lbTitle: "🏆 LEADERBOARD",
        lbSubtitle: "Each player's personal best — fewest guesses wins",
        lbAllTime: "All-Time",
        lbWeekly: "This Week",
        lbLoading: "Loading…",
        lbEmptyWeekly: "No wins recorded this week yet — go play!",
        lbEmptyAll: "No wins recorded yet — go play!",
        lbGuessSingular: "guess",
        lbGuessPlural: "guesses",
        lbErrorLoad: "Couldn't load the leaderboard — check your connection.",
        lbYouTag: "you",
        lbYourRank: "Your rank",
        lbRankBeyond: "You're ranked beyond what we can show here — keep climbing!",

        // DIFFICULTY SCREEN
        diffScreenTitle: "SELECT DIFFICULTY",
        diffScreenSubtitle: "How good is your football knowledge?",
        easyDesc: "Famous footballers",
        mediumDesc: "Famous & less obvious players",
        hardDesc: "Serious football knowledge",
        legendsDesc: "Retired icons & GOATs",

        // SETTINGS
        settingsTitle: "⚙️ SETTINGS",
        settingsSoundSection: "SOUND",
        settingsSounds: "Sounds",
        settingsOtherSection: "OTHER",
        settingsMusic: "Music",
        settingsSfx: "Sound Effects",
        settingsVibration: "Vibration",
        settingsReset: "🗑️ RESET PROGRESS",
        settingsResetConfirm: "⚠️ TAP AGAIN TO CONFIRM",
        settingsAbout: "ABOUT THIS GAME",
        settingsMadeBy: "Made by Vanitas",
        settingsWhoIsVanitas: "🙋 Who is Vanitas?",
        settingsSupportKofi: "☕ Support on Ko-fi",

        // NICKNAME PROMPT
        nickTitle: "👋 What should we call you?",
        nickSubtitle: "Your nickname is saved on this device and shown on the leaderboard.",
        nickPlaceholder: "Enter a nickname",
        nickSubmit: "Let's play"
    },

    fr: {
        name: "Français",
        flag: "fr",

        tagline: "LE JEU ULTIME DE DEVINETTE DE FOOTBALL",
        play: "🎮 JOUER",
        daily: "🔥 DÉFI QUOTIDIEN",
        stats: "📊 STATISTIQUES",
        howToPlay: "❓ COMMENT JOUER",
        footer: "Devinez le joueur. Maîtrisez le jeu.",

        easy: "FACILE",
        medium: "MOYEN",
        hard: "DIFFICILE",
        legends: "LÉGENDES",
        attempts: "essais",

        dailyLabel: "🔥 QUOTIDIEN",
        attemptsLeft: "essais restants",

        search: "Rechercher un footballeur...",
        guess: "DEVINER",
        hint: "💡 INDICE",
        hintUsed: "💡 UTILISÉ",
        giveUp: "🏳️ ABANDONNER",
        share: "📋 PARTAGER",

        player: "JOUEUR",
        country: "PAYS",
        club: "CLUB",
        league: "LIGUE",
        position: "POSITION",
        age: "ÂGE",
        foot: "PIED",

        games: "Parties",
        wins: "Victoires",
        winRate: "Taux de victoire",
        streak: "Série",
        dailyStreak: "Série quotidienne",
        achievements: "SUCCÈS",

        howTitle: "❓ COMMENT JOUER",
        how1: "Devinez le footballeur mystère avec la barre de recherche — choisissez un nom parmi les suggestions.",
        how2: "Chaque tentative révèle des indices : vert = correct, jaune = proche, rouge = incorrect.",
        how3: "Pour l'âge, une flèche indique si le vrai joueur est plus âgé ⬆️ ou plus jeune ⬇️.",
        how4: "Choisissez une difficulté — plus d'essais en Facile, moins lorsque la difficulté augmente.",
        how5: "🔥 Le Défi quotidien donne à tout le monde le même joueur mystère une fois par jour.",
        how6: "💡 Utilisez un indice gratuit par partie si vous êtes bloqué.",
        how7: "📋 Partagez vos résultats avec une grille d'emojis à la fin de la partie.",
        how8: "🏆 Débloquez des succès en réalisant des exploits particuliers.",

        chooseSuggestion: "❌ Choisissez un footballeur parmi les suggestions.",
        amazing: "🎉 BRAVO ! Vous avez trouvé {player} !",
        gameOver: "😢 Partie terminée ! Le joueur était {player}.",
        notThisOne: "❌ Ce n'est pas lui ! Il vous reste {amount} essais.",
        gaveUp: "🏳️ Vous avez abandonné. Le joueur était {player}.",
        copied: "📋 Résultats copiés !",

        dailySolved: "✅ Défi du jour réussi !",
        dailyAttempted: "❌ Défi du jour tenté.",
        alreadyPlayed: "🔥 Vous avez déjà joué au Défi quotidien ! Revenez demain pour un nouveau joueur.",

        hintNormal: "💡 Ce joueur vient de {flag} {country} et joue dans le {league}.",
        hintLegend: "💡 Ce joueur vient de {flag} {country} et a joué dans le {league}.",
        hintPlaysFor: "joue pour",
        hintUsedToPlayFor: "a joué pour",
        hintFooted: "{foot} pied",
        footLeft: "gauche",
        footRight: "droit",
        posGoalkeeper: "Gardien",
        posDefender: "Défenseur",
        posMidfielder: "Milieu",
        posWinger: "Ailier",
        posForward: "Attaquant",

        achievementUnlocked: "Succès débloqué",
        locked: "Verrouillé — ",

        // MULTIPLAYER
        mpMenuTitle: "👥 MULTIJOUEUR",
        mpMenuSubtitle: "Affrontez un ami pour deviner le footballeur mystère en premier",
        mpCreateParty: "🎉 CRÉER UNE PARTIE",
        mpJoinParty: "🔑 REJOINDRE UNE PARTIE",
        mpBack: "← RETOUR",

        mpCreatePartyTitle: "🎉 CRÉER UNE PARTIE",
        mpCreatePartySubtitle: "Configurez la salle pour votre partie",
        mpDifficultyLabel: "DIFFICULTÉ",
        mpRoundsLabel: "MANCHES",
        mpHintsLabel: "INDICES (par joueur, par manche)",
        mpHintsOff: "🚫 Aucun",
        mpPrivacyLabel: "CONFIDENTIALITÉ",
        mpPillEasy: "🟢 Facile",
        mpPillMedium: "🟡 Moyen",
        mpPillHard: "🔴 Difficile",
        mpPillLegends: "🟣 Légendes",
        mpPublic: "🌐 Public",
        mpPrivate: "🔒 Privé",
        mpPasswordPlaceholder: "Mot de passe de la partie",
        mpCreateButton: "CRÉER LA PARTIE",
        mpErrorNickname: "Choisissez d'abord un pseudo.",
        mpErrorPassword: "Entrez un mot de passe ou passez en Public.",

        mpJoinPartyTitle: "🔑 REJOINDRE UNE PARTIE",
        mpJoinPartySubtitle: "Entrez le code partagé par votre ami",
        mpPartyCodeLabel: "CODE DE LA PARTIE",
        mpPasswordLabel: "MOT DE PASSE (si privée)",
        mpPasswordLeaveBlank: "Laissez vide si publique",
        mpJoinButton: "REJOINDRE",
        mpErrorCode: "Entrez le code de 5 caractères.",
        mpConnecting: "Connexion…",
        mpNoResponse: "Aucune réponse de cette partie. Vérifiez le code et réessayez.",
        mpWrongPassword: "Mot de passe incorrect.",
        mpAlreadyStarted: "Cette partie a déjà commencé.",
        mpCouldntJoin: "Impossible de rejoindre cette partie.",

        mpLobbyTitle: "🎉 SALON DE PARTIE",
        mpCodeLabel: "CODE",
        mpCopyButton: "📋 COPIER",
        mpCopied: "✅ COPIÉ",
        mpStartGame: "▶ LANCER LA PARTIE",
        mpNeedTwoPlayers: "Il faut au moins 2 joueurs pour commencer.",
        mpWaitingForHost: "En attente que l'hôte lance la partie…",
        mpYouSuffix: " (vous)",
        mpHostBadge: "HÔTE",
        mpLeaveParty: "← QUITTER LA PARTIE",
        mpRoundWord: "manche",
        mpRoundsWord: "manches",

        mpRoundInfo: "MANCHE {round} / {total}",
        mpHostDisconnected: "⚠️ L'hôte s'est déconnecté.",
        mpFoundFirst: "🎉 BRAVO ! Vous avez trouvé {player} en premier !",
        mpOutOfAttempts: "⏳ Plus d'essais — en attente des autres…",

        mpWonRound: "🎉 Vous avez gagné la manche !",
        mpPlayerWonRound: "{nickname} a gagné la manche",
        mpNobodyGotIt: "Personne n'a trouvé !",
        mpPlayerWas: "Le joueur était {player}.",
        mpFinalResultsComing: "Résultats finaux dans un instant…",
        mpRoundStartingSoon: "Manche {round} dans un instant…",
        mpPointSingular: "pt",
        mpPointPlural: "pts",
        mpPlayerDefaultName: "Joueur",

        mpPartyResults: "🏆 RÉSULTATS DE LA PARTIE",
        mpBackToMenu: "RETOUR AU MENU",
        mpRematch: "🔁 REVANCHE",
        mpChangeSettings: "⚙️ MODIFIER LES RÉGLAGES",
        mpRematchStatus: "{voted}/{total} prêts — en attente…",
        mpSaveSettings: "💾 ENREGISTRER",
        mpHostChangingSettings: "⚙️ L'hôte modifie les réglages…",

        // LEADERBOARD
        lbMenuButton: "🏆 CLASSEMENT",
        lbTitle: "🏆 CLASSEMENT",
        lbSubtitle: "Le meilleur score de chaque joueur — moins d'essais gagne",
        lbAllTime: "Depuis toujours",
        lbWeekly: "Cette semaine",
        lbLoading: "Chargement…",
        lbEmptyWeekly: "Aucune victoire cette semaine — allez jouer !",
        lbEmptyAll: "Aucune victoire enregistrée — allez jouer !",
        lbGuessSingular: "essai",
        lbGuessPlural: "essais",
        lbErrorLoad: "Impossible de charger le classement — vérifiez votre connexion.",
        lbYouTag: "vous",
        lbYourRank: "Votre rang",
        lbRankBeyond: "Votre rang dépasse ce qu'on peut afficher ici — continuez à grimper !",

        // DIFFICULTY SCREEN
        diffScreenTitle: "CHOISIR LA DIFFICULTÉ",
        diffScreenSubtitle: "À quel point connais-tu le football ?",
        easyDesc: "Footballeurs célèbres",
        mediumDesc: "Joueurs célèbres et moins évidents",
        hardDesc: "Vraie connaissance du football",
        legendsDesc: "Icônes retraitées et GOATs",

        // SETTINGS
        settingsTitle: "⚙️ PARAMÈTRES",
        settingsSoundSection: "SON",
        settingsSounds: "Sons",
        settingsOtherSection: "AUTRE",
        settingsMusic: "Musique",
        settingsSfx: "Effets sonores",
        settingsVibration: "Vibration",
        settingsReset: "🗑️ RÉINITIALISER",
        settingsResetConfirm: "⚠️ APPUYER À NOUVEAU POUR CONFIRMER",
        settingsAbout: "À PROPOS DU JEU",
        settingsMadeBy: "Créé par Vanitas",
        settingsWhoIsVanitas: "🙋 Qui est Vanitas ?",
        settingsSupportKofi: "☕ Soutenir sur Ko-fi",

        // NICKNAME PROMPT
        nickTitle: "👋 Comment doit-on t'appeler ?",
        nickSubtitle: "Ton pseudo est enregistré sur cet appareil et affiché dans le classement.",
        nickPlaceholder: "Entre un pseudo",
        nickSubmit: "C'est parti"
    },

    ar: {
        name: "العربية",
        flag: "ma",

        tagline: "لعبة تخمين لاعبي كرة القدم",
        play: "🎮 العب",
        daily: "🔥 التحدي اليومي",
        stats: "📊 الإحصائيات",
        howToPlay: "❓ كيفية اللعب",
        footer: "خمن اللاعب. أتقن اللعبة.",

        easy: "سهل",
        medium: "متوسط",
        hard: "صعب",
        legends: "الأساطير",
        attempts: "محاولات",

        dailyLabel: "🔥 يومي",
        attemptsLeft: "محاولات متبقية",

        search: "ابحث عن لاعب كرة قدم...",
        gameTitle: "من هو اللاعب؟",
        gameSubtitle: "خمن لاعب كرة القدم الغامض",
        backMenu: "← القائمة",
        guess: "خمن",
        hint: "💡 تلميح",
        hintUsed: "💡 تم الاستخدام",
        giveUp: "🏳️ استسلام",
        share: "📋 مشاركة النتائج",

        player: "اللاعب",
        country: "الدولة",
        club: "النادي",
        league: "الدوري",
        position: "المركز",
        age: "العمر",
        foot: "القدم",

        games: "المباريات",
        wins: "الانتصارات",
        winRate: "نسبة الفوز",
        streak: "سلسلة الانتصارات",
        dailyStreak: "السلسلة اليومية",
        achievements: "الإنجازات",

        howTitle: "❓ كيفية اللعب",
        how1: "خمن لاعب كرة القدم الغامض باستخدام مربع البحث — اختر اسماً من الاقتراحات.",
        how2: "كل محاولة تكشف تلميحات: الأخضر = صحيح، الأصفر = قريب، الأحمر = خطأ.",
        how3: "بالنسبة للعمر، يشير السهم إلى ما إذا كان اللاعب الحقيقي أكبر ⬆️ أو أصغر ⬇️.",
        how4: "اختر مستوى الصعوبة — محاولات أكثر في السهل ومحاولات أقل كلما زادت الصعوبة.",
        how5: "🔥 التحدي اليومي يعطي الجميع نفس اللاعب الغامض مرة واحدة يومياً.",
        how6: "💡 استخدم تلميحاً مجانياً واحداً في كل مباراة إذا واجهتك صعوبة.",
        how7: "📋 شارك نتائجك على شكل شبكة من الإيموجي بعد انتهاء المباراة.",
        how8: "🏆 افتح الإنجازات من خلال تحقيق طرق خاصة للفوز.",

        chooseSuggestion: "❌ اختر لاعب كرة قدم من الاقتراحات.",
        amazing: "🎉 رائع! لقد وجدت {player}!",
        gameOver: "😢 انتهت اللعبة! اللاعب كان {player}.",
        notThisOne: "❌ ليس هذا اللاعب! تبقت {amount} محاولات.",
        gaveUp: "🏳️ لقد استسلمت. اللاعب كان {player}.",
        copied: "📋 تم نسخ النتائج!",

        dailySolved: "✅ تم حل تحدي اليوم!",
        dailyAttempted: "❌ تمت محاولة تحدي اليوم.",
        alreadyPlayed: "🔥 لقد لعبت تحدي اليوم بالفعل! عد غداً للاعب جديد.",

        hintNormal: "💡 هذا اللاعب من {flag} {country} ويلعب في {league}.",
        hintLegend: "💡 هذا اللاعب من {flag} {country} ولعب سابقاً في {league}.",
        hintPlaysFor: "يلعب لـ",
        hintUsedToPlayFor: "كان يلعب لـ",
        hintFooted: "قدم {foot}",
        footLeft: "يسرى",
        footRight: "يمنى",
        posGoalkeeper: "حارس",
        posDefender: "مدافع",
        posMidfielder: "وسط",
        posWinger: "جناح",
        posForward: "مهاجم",

        achievementUnlocked: "تم فتح إنجاز",
        locked: "مغلق — ",

        // MULTIPLAYER
        mpMenuTitle: "👥 متعدد اللاعبين",
        mpMenuSubtitle: "سابق صديقك لتخمين لاعب كرة القدم الغامض أولاً",
        mpCreateParty: "🎉 إنشاء غرفة",
        mpJoinParty: "🔑 الانضمام إلى غرفة",
        mpBack: "← رجوع",

        mpCreatePartyTitle: "🎉 إنشاء غرفة",
        mpCreatePartySubtitle: "قم بإعداد غرفة اللعب الخاصة بك",
        mpDifficultyLabel: "الصعوبة",
        mpRoundsLabel: "الجولات",
        mpHintsLabel: "التلميحات (لكل لاعب، لكل جولة)",
        mpHintsOff: "🚫 بدون",
        mpPrivacyLabel: "الخصوصية",
        mpPillEasy: "🟢 سهل",
        mpPillMedium: "🟡 متوسط",
        mpPillHard: "🔴 صعب",
        mpPillLegends: "🟣 الأساطير",
        mpPublic: "🌐 عامة",
        mpPrivate: "🔒 خاصة",
        mpPasswordPlaceholder: "كلمة مرور الغرفة",
        mpCreateButton: "إنشاء الغرفة",
        mpErrorNickname: "اختر اسماً مستعاراً أولاً.",
        mpErrorPassword: "أدخل كلمة مرور أو بدّل إلى عامة.",

        mpJoinPartyTitle: "🔑 الانضمام إلى غرفة",
        mpJoinPartySubtitle: "أدخل الرمز الذي شاركه صديقك",
        mpPartyCodeLabel: "رمز الغرفة",
        mpPasswordLabel: "كلمة المرور (إذا كانت خاصة)",
        mpPasswordLeaveBlank: "اتركه فارغاً إذا كانت عامة",
        mpJoinButton: "انضمام",
        mpErrorCode: "أدخل رمزاً مكوناً من 5 أحرف.",
        mpConnecting: "جارٍ الاتصال…",
        mpNoResponse: "لا استجابة من تلك الغرفة. تحقق من الرمز وحاول مجدداً.",
        mpWrongPassword: "كلمة مرور خاطئة.",
        mpAlreadyStarted: "لعبة هذه الغرفة بدأت بالفعل.",
        mpCouldntJoin: "تعذّر الانضمام إلى هذه الغرفة.",

        mpLobbyTitle: "🎉 صالة الانتظار",
        mpCodeLabel: "الرمز",
        mpCopyButton: "📋 نسخ",
        mpCopied: "✅ تم النسخ",
        mpStartGame: "▶ بدء اللعبة",
        mpNeedTwoPlayers: "يلزم لاعبان على الأقل للبدء.",
        mpWaitingForHost: "في انتظار أن يبدأ المضيف اللعبة…",
        mpYouSuffix: " (أنت)",
        mpHostBadge: "المضيف",
        mpLeaveParty: "← مغادرة الغرفة",
        mpRoundWord: "جولة",
        mpRoundsWord: "جولات",

        mpRoundInfo: "الجولة {round} / {total}",
        mpHostDisconnected: "⚠️ انقطع اتصال المضيف.",
        mpFoundFirst: "🎉 رائع! لقد وجدت {player} أولاً!",
        mpOutOfAttempts: "⏳ نفدت محاولاتك — في انتظار الآخرين…",

        mpWonRound: "🎉 لقد فزت بالجولة!",
        mpPlayerWonRound: "{nickname} فاز بالجولة",
        mpNobodyGotIt: "لم يخمنه أحد!",
        mpPlayerWas: "اللاعب كان {player}.",
        mpFinalResultsComing: "النتائج النهائية قريباً…",
        mpRoundStartingSoon: "الجولة {round} تبدأ قريباً…",
        mpPointSingular: "نقطة",
        mpPointPlural: "نقاط",
        mpPlayerDefaultName: "لاعب",

        mpPartyResults: "🏆 نتائج الغرفة",
        mpBackToMenu: "العودة إلى القائمة",
        mpRematch: "🔁 إعادة المباراة",
        mpChangeSettings: "⚙️ تغيير الإعدادات",
        mpRematchStatus: "{voted}/{total} جاهز — في الانتظار…",
        mpSaveSettings: "💾 حفظ الإعدادات",
        mpHostChangingSettings: "⚙️ المضيف يغيّر الإعدادات…",

        // LEADERBOARD
        lbMenuButton: "🏆 لوحة الصدارة",
        lbTitle: "🏆 لوحة الصدارة",
        lbSubtitle: "أفضل نتيجة لكل لاعب — الأقل محاولات يفوز",
        lbAllTime: "كل الأوقات",
        lbWeekly: "هذا الأسبوع",
        lbLoading: "جارٍ التحميل…",
        lbEmptyWeekly: "لا توجد انتصارات هذا الأسبوع بعد — اذهب والعب!",
        lbEmptyAll: "لا توجد انتصارات مسجلة بعد — اذهب والعب!",
        lbGuessSingular: "محاولة",
        lbGuessPlural: "محاولات",
        lbErrorLoad: "تعذّر تحميل لوحة الصدارة — تحقق من اتصالك.",
        lbYouTag: "أنت",
        lbYourRank: "ترتيبك",
        lbRankBeyond: "ترتيبك أبعد مما يمكننا عرضه هنا — واصل التقدم!",

        // DIFFICULTY SCREEN
        diffScreenTitle: "اختر مستوى الصعوبة",
        diffScreenSubtitle: "ما مدى معرفتك بكرة القدم؟",
        easyDesc: "لاعبون مشهورون",
        mediumDesc: "لاعبون مشهورون وأقل شهرة",
        hardDesc: "معرفة جادة بكرة القدم",
        legendsDesc: "أيقونات متقاعدة وأفضل اللاعبين",

        // SETTINGS
        settingsTitle: "⚙️ الإعدادات",
        settingsSoundSection: "الصوت",
        settingsSounds: "الأصوات",
        settingsOtherSection: "أخرى",
        settingsMusic: "الموسيقى",
        settingsSfx: "المؤثرات الصوتية",
        settingsVibration: "الاهتزاز",
        settingsReset: "🗑️ إعادة تعيين التقدم",
        settingsResetConfirm: "⚠️ اضغط مجدداً للتأكيد",
        settingsAbout: "حول هذه اللعبة",
        settingsMadeBy: "صنع بواسطة Vanitas",
        settingsWhoIsVanitas: "🙋 من هو Vanitas؟",
        settingsSupportKofi: "☕ ادعم على Ko-fi",

        // NICKNAME PROMPT
        nickTitle: "👋 ماذا نناديك؟",
        nickSubtitle: "يُحفظ اسمك المستعار على هذا الجهاز ويظهر في لوحة المتصدرين.",
        nickPlaceholder: "أدخل اسماً مستعاراً",
        nickSubmit: "هيا نلعب"
    },

    es: {
        name: "Español",
        flag: "es",

        tagline: "EL JUEGO DEFINITIVO PARA ADIVINAR FUTBOLISTAS",
        play: "🎮 JUGAR",
        daily: "🔥 DESAFÍO DIARIO",
        stats: "📊 ESTADÍSTICAS",
        howToPlay: "❓ CÓMO JUGAR",
        footer: "Adivina el jugador. Domina el juego.",

        easy: "FÁCIL",
        medium: "MEDIO",
        hard: "DIFÍCIL",
        legends: "LEYENDAS",
        attempts: "intentos",

        dailyLabel: "🔥 DIARIO",
        attemptsLeft: "intentos restantes",

        search: "Buscar un futbolista...",
        gameTitle: "¿QUIÉN ES EL JUGADOR?",
        gameSubtitle: "Adivina el futbolista misterioso",
        backMenu: "← MENÚ",
        guess: "ADIVINAR",
        hint: "💡 PISTA",
        hintUsed: "💡 USADA",
        giveUp: "🏳️ RENDIRSE",
        share: "📋 COMPARTIR RESULTADOS",

        player: "JUGADOR",
        country: "PAÍS",
        club: "CLUB",
        league: "LIGA",
        position: "POSICIÓN",
        age: "EDAD",
        foot: "PIE",

        games: "Partidas",
        wins: "Victorias",
        winRate: "Tasa de victoria",
        streak: "Racha",
        dailyStreak: "Racha diaria",
        achievements: "LOGROS",

        howTitle: "❓ CÓMO JUGAR",
        how1: "Adivina el futbolista misterioso usando el buscador — elige un nombre de las sugerencias.",
        how2: "Cada intento revela pistas: verde = correcto, amarillo = cerca, rojo = incorrecto.",
        how3: "Para la edad, una flecha indica si el jugador real es mayor ⬆️ o menor ⬇️.",
        how4: "Elige una dificultad — más intentos en Fácil y menos cuanto más difícil sea.",
        how5: "🔥 El Desafío diario da a todos el mismo jugador misterioso una vez al día.",
        how6: "💡 Usa una pista gratuita por partida si estás atascado.",
        how7: "📋 Comparte tus resultados como una cuadrícula de emojis al terminar.",
        how8: "🏆 Desbloquea logros de formas especiales.",

        chooseSuggestion: "❌ Elige un futbolista de las sugerencias.",
        amazing: "🎉 ¡INCREÍBLE! ¡Encontraste a {player}!",
        gameOver: "😢 ¡Fin del juego! El jugador era {player}.",
        notThisOne: "❌ ¡No es este! Te quedan {amount} intentos.",
        gaveUp: "🏳️ Te rendiste. El jugador era {player}.",
        copied: "📋 ¡Resultados copiados!",

        dailySolved: "✅ ¡Desafío de hoy resuelto!",
        dailyAttempted: "❌ Desafío de hoy intentado.",
        alreadyPlayed: "🔥 ¡Ya jugaste el Desafío diario de hoy! Vuelve mañana para uno nuevo.",

        hintNormal: "💡 Este jugador es de {flag} {country} y juega en la {league}.",
        hintLegend: "💡 Este jugador es de {flag} {country} y jugó en la {league}.",
        hintPlaysFor: "juega para",
        hintUsedToPlayFor: "jugaba para",
        hintFooted: "pie {foot}",
        footLeft: "izquierdo",
        footRight: "derecho",
        posGoalkeeper: "Portero",
        posDefender: "Defensa",
        posMidfielder: "Centrocampista",
        posWinger: "Extremo",
        posForward: "Delantero",

        achievementUnlocked: "Logro desbloqueado",
        locked: "Bloqueado — ",

        // MULTIPLAYER
        mpMenuTitle: "👥 MULTIJUGADOR",
        mpMenuSubtitle: "Compite con un amigo para adivinar primero al futbolista misterioso",
        mpCreateParty: "🎉 CREAR SALA",
        mpJoinParty: "🔑 UNIRSE A SALA",
        mpBack: "← VOLVER",

        mpCreatePartyTitle: "🎉 CREAR SALA",
        mpCreatePartySubtitle: "Configura la sala para tu partida",
        mpDifficultyLabel: "DIFICULTAD",
        mpRoundsLabel: "RONDAS",
        mpHintsLabel: "PISTAS (por jugador, por ronda)",
        mpHintsOff: "🚫 Ninguna",
        mpPrivacyLabel: "PRIVACIDAD",
        mpPillEasy: "🟢 Fácil",
        mpPillMedium: "🟡 Medio",
        mpPillHard: "🔴 Difícil",
        mpPillLegends: "🟣 Leyendas",
        mpPublic: "🌐 Pública",
        mpPrivate: "🔒 Privada",
        mpPasswordPlaceholder: "Contraseña de la sala",
        mpCreateButton: "CREAR SALA",
        mpErrorNickname: "Elige un apodo primero.",
        mpErrorPassword: "Ingresa una contraseña o cambia a Pública.",

        mpJoinPartyTitle: "🔑 UNIRSE A SALA",
        mpJoinPartySubtitle: "Introduce el código que te compartió tu amigo",
        mpPartyCodeLabel: "CÓDIGO DE LA SALA",
        mpPasswordLabel: "CONTRASEÑA (si es privada)",
        mpPasswordLeaveBlank: "Déjalo en blanco si es pública",
        mpJoinButton: "UNIRSE",
        mpErrorCode: "Introduce el código de 5 caracteres.",
        mpConnecting: "Conectando…",
        mpNoResponse: "Sin respuesta de esa sala. Revisa el código e inténtalo de nuevo.",
        mpWrongPassword: "Contraseña incorrecta.",
        mpAlreadyStarted: "Esa sala ya comenzó la partida.",
        mpCouldntJoin: "No se pudo unir a esa sala.",

        mpLobbyTitle: "🎉 SALA DE ESPERA",
        mpCodeLabel: "CÓDIGO",
        mpCopyButton: "📋 COPIAR",
        mpCopied: "✅ COPIADO",
        mpStartGame: "▶ INICIAR PARTIDA",
        mpNeedTwoPlayers: "Se necesitan al menos 2 jugadores para empezar.",
        mpWaitingForHost: "Esperando a que el anfitrión inicie la partida…",
        mpYouSuffix: " (tú)",
        mpHostBadge: "ANFITRIÓN",
        mpLeaveParty: "← SALIR DE LA SALA",
        mpRoundWord: "ronda",
        mpRoundsWord: "rondas",

        mpRoundInfo: "RONDA {round} / {total}",
        mpHostDisconnected: "⚠️ El anfitrión se desconectó.",
        mpFoundFirst: "🎉 ¡INCREÍBLE! ¡Encontraste a {player} primero!",
        mpOutOfAttempts: "⏳ Sin intentos — esperando a los demás…",

        mpWonRound: "🎉 ¡Ganaste la ronda!",
        mpPlayerWonRound: "{nickname} ganó la ronda",
        mpNobodyGotIt: "¡Nadie lo adivinó!",
        mpPlayerWas: "El jugador era {player}.",
        mpFinalResultsComing: "Resultados finales en un momento…",
        mpRoundStartingSoon: "Ronda {round} comienza pronto…",
        mpPointSingular: "pt",
        mpPointPlural: "pts",
        mpPlayerDefaultName: "Jugador",

        mpPartyResults: "🏆 RESULTADOS DE LA SALA",
        mpBackToMenu: "VOLVER AL MENÚ",
        mpRematch: "🔁 REVANCHA",
        mpChangeSettings: "⚙️ CAMBIAR AJUSTES",
        mpRematchStatus: "{voted}/{total} listos — esperando…",
        mpSaveSettings: "💾 GUARDAR AJUSTES",
        mpHostChangingSettings: "⚙️ El anfitrión está cambiando los ajustes…",

        // LEADERBOARD
        lbMenuButton: "🏆 CLASIFICACIÓN",
        lbTitle: "🏆 CLASIFICACIÓN",
        lbSubtitle: "El mejor resultado de cada jugador — menos intentos gana",
        lbAllTime: "Histórico",
        lbWeekly: "Esta semana",
        lbLoading: "Cargando…",
        lbEmptyWeekly: "Aún no hay victorias esta semana — ¡a jugar!",
        lbEmptyAll: "Aún no hay victorias registradas — ¡a jugar!",
        lbGuessSingular: "intento",
        lbGuessPlural: "intentos",
        lbErrorLoad: "No se pudo cargar la clasificación — revisa tu conexión.",
        lbYouTag: "tú",
        lbYourRank: "Tu posición",
        lbRankBeyond: "Tu posición está más allá de lo que podemos mostrar aquí — ¡sigue subiendo!",

        // DIFFICULTY SCREEN
        diffScreenTitle: "SELECCIONAR DIFICULTAD",
        diffScreenSubtitle: "¿Cuánto sabes de fútbol?",
        easyDesc: "Futbolistas famosos",
        mediumDesc: "Jugadores famosos y menos obvios",
        hardDesc: "Conocimiento serio de fútbol",
        legendsDesc: "Iconos retirados y GOATs",

        // SETTINGS
        settingsTitle: "⚙️ AJUSTES",
        settingsSoundSection: "SONIDO",
        settingsSounds: "Sonidos",
        settingsOtherSection: "OTRO",
        settingsMusic: "Música",
        settingsSfx: "Efectos de sonido",
        settingsVibration: "Vibración",
        settingsReset: "🗑️ RESTABLECER PROGRESO",
        settingsResetConfirm: "⚠️ TOCA OTRA VEZ PARA CONFIRMAR",
        settingsAbout: "ACERCA DEL JUEGO",
        settingsMadeBy: "Creado por Vanitas",
        settingsWhoIsVanitas: "🙋 ¿Quién es Vanitas?",
        settingsSupportKofi: "☕ Apoyar en Ko-fi",

        // NICKNAME PROMPT
        nickTitle: "👋 ¿Cómo te llamamos?",
        nickSubtitle: "Tu apodo se guarda en este dispositivo y aparece en la clasificación.",
        nickPlaceholder: "Escribe un apodo",
        nickSubmit: "A jugar"
    },

    it: {
        name: "Italiano",
        flag: "it",

        tagline: "IL GIOCO DEFINITIVO PER INDOVINARE I CALCIATORI",
        play: "🎮 GIOCA",
        daily: "🔥 SFIDA QUOTIDIANA",
        stats: "📊 STATISTICHE",
        howToPlay: "❓ COME SI GIOCA",
        footer: "Indovina il giocatore. Domina il gioco.",

        easy: "FACILE",
        medium: "MEDIO",
        hard: "DIFFICILE",
        legends: "LEGGENDE",
        attempts: "tentativi",

        dailyLabel: "🔥 QUOTIDIANA",
        attemptsLeft: "tentativi rimasti",

        search: "Cerca un calciatore...",
        gameTitle: "CHI È IL GIOCATORE?",
        gameSubtitle: "Indovina il calciatore misterioso",
        backMenu: "← MENU",
        guess: "INDOVINA",
        hint: "💡 INDIZIO",
        hintUsed: "💡 USATO",
        giveUp: "🏳️ ARRENDERSI",
        share: "📋 CONDIVIDI RISULTATI",

        player: "GIOCATORE",
        country: "NAZIONE",
        club: "CLUB",
        league: "CAMPIONATO",
        position: "RUOLO",
        age: "ETÀ",
        foot: "PIEDE",

        games: "Partite",
        wins: "Vittorie",
        winRate: "Percentuale vittorie",
        streak: "Serie",
        dailyStreak: "Serie giornaliera",
        achievements: "OBIETTIVI",

        howTitle: "❓ COME SI GIOCA",
        how1: "Indovina il calciatore misterioso usando la barra di ricerca — scegli un nome dai suggerimenti.",
        how2: "Ogni tentativo rivela degli indizi: verde = corretto, giallo = vicino, rosso = sbagliato.",
        how3: "Per l'età, una freccia indica se il giocatore reale è più grande ⬆️ o più giovane ⬇️.",
        how4: "Scegli una difficoltà — più tentativi in Facile e meno aumentando la difficoltà.",
        how5: "🔥 La Sfida quotidiana dà a tutti lo stesso giocatore misterioso una volta al giorno.",
        how6: "💡 Usa un indizio gratuito per partita se sei bloccato.",
        how7: "📋 Condividi i risultati come griglia di emoji alla fine della partita.",
        how8: "🏆 Sblocca obiettivi completando imprese speciali.",

        chooseSuggestion: "❌ Scegli un calciatore dai suggerimenti.",
        amazing: "🎉 INCREDIBILE! Hai trovato {player}!",
        gameOver: "😢 Game over! Il giocatore era {player}.",
        notThisOne: "❌ Non è lui! Ti rimangono {amount} tentativi.",
        gaveUp: "🏳️ Hai abbandonato. Il giocatore era {player}.",
        copied: "📋 Risultati copiati!",

        dailySolved: "✅ Sfida di oggi completata!",
        dailyAttempted: "❌ Sfida di oggi tentata.",
        alreadyPlayed: "🔥 Hai già giocato la Sfida quotidiana di oggi! Torna domani per una nuova sfida.",

        hintNormal: "💡 Questo giocatore viene da {flag} {country} e gioca nella {league}.",
        hintLegend: "💡 Questo giocatore viene da {flag} {country} e ha giocato nella {league}.",
        hintPlaysFor: "gioca per",
        hintUsedToPlayFor: "ha giocato per",
        hintFooted: "piede {foot}",
        footLeft: "sinistro",
        footRight: "destro",
        posGoalkeeper: "Portiere",
        posDefender: "Difensore",
        posMidfielder: "Centrocampista",
        posWinger: "Ala",
        posForward: "Attaccante",

        achievementUnlocked: "Obiettivo sbloccato",
        locked: "Bloccato — ",

        // MULTIPLAYER
        mpMenuTitle: "👥 MULTIPLAYER",
        mpMenuSubtitle: "Sfida un amico a indovinare per primo il calciatore misterioso",
        mpCreateParty: "🎉 CREA STANZA",
        mpJoinParty: "🔑 UNISCITI A STANZA",
        mpBack: "← INDIETRO",

        mpCreatePartyTitle: "🎉 CREA STANZA",
        mpCreatePartySubtitle: "Configura la stanza per la tua partita",
        mpDifficultyLabel: "DIFFICOLTÀ",
        mpRoundsLabel: "MANCHE",
        mpHintsLabel: "INDIZI (per giocatore, per manche)",
        mpHintsOff: "🚫 Nessuno",
        mpPrivacyLabel: "PRIVACY",
        mpPillEasy: "🟢 Facile",
        mpPillMedium: "🟡 Medio",
        mpPillHard: "🔴 Difficile",
        mpPillLegends: "🟣 Leggende",
        mpPublic: "🌐 Pubblica",
        mpPrivate: "🔒 Privata",
        mpPasswordPlaceholder: "Password della stanza",
        mpCreateButton: "CREA STANZA",
        mpErrorNickname: "Scegli prima un nickname.",
        mpErrorPassword: "Inserisci una password o passa a Pubblica.",

        mpJoinPartyTitle: "🔑 UNISCITI A STANZA",
        mpJoinPartySubtitle: "Inserisci il codice condiviso dal tuo amico",
        mpPartyCodeLabel: "CODICE STANZA",
        mpPasswordLabel: "PASSWORD (se privata)",
        mpPasswordLeaveBlank: "Lascia vuoto se pubblica",
        mpJoinButton: "UNISCITI",
        mpErrorCode: "Inserisci il codice di 5 caratteri.",
        mpConnecting: "Connessione…",
        mpNoResponse: "Nessuna risposta da quella stanza. Controlla il codice e riprova.",
        mpWrongPassword: "Password errata.",
        mpAlreadyStarted: "La partita di quella stanza è già iniziata.",
        mpCouldntJoin: "Impossibile unirsi a quella stanza.",

        mpLobbyTitle: "🎉 SALA D'ATTESA",
        mpCodeLabel: "CODICE",
        mpCopyButton: "📋 COPIA",
        mpCopied: "✅ COPIATO",
        mpStartGame: "▶ INIZIA PARTITA",
        mpNeedTwoPlayers: "Servono almeno 2 giocatori per iniziare.",
        mpWaitingForHost: "In attesa che l'host avvii la partita…",
        mpYouSuffix: " (tu)",
        mpHostBadge: "HOST",
        mpLeaveParty: "← LASCIA STANZA",
        mpRoundWord: "manche",
        mpRoundsWord: "manche",

        mpRoundInfo: "MANCHE {round} / {total}",
        mpHostDisconnected: "⚠️ L'host si è disconnesso.",
        mpFoundFirst: "🎉 INCREDIBILE! Hai trovato {player} per primo!",
        mpOutOfAttempts: "⏳ Tentativi finiti — in attesa degli altri…",

        mpWonRound: "🎉 Hai vinto la manche!",
        mpPlayerWonRound: "{nickname} ha vinto la manche",
        mpNobodyGotIt: "Nessuno l'ha indovinato!",
        mpPlayerWas: "Il giocatore era {player}.",
        mpFinalResultsComing: "Risultati finali tra poco…",
        mpRoundStartingSoon: "Manche {round} tra poco…",
        mpPointSingular: "pt",
        mpPointPlural: "pt",
        mpPlayerDefaultName: "Giocatore",

        mpPartyResults: "🏆 RISULTATI DELLA STANZA",
        mpBackToMenu: "TORNA AL MENU",
        mpRematch: "🔁 RIVINCITA",
        mpChangeSettings: "⚙️ CAMBIA IMPOSTAZIONI",
        mpRematchStatus: "{voted}/{total} pronti — in attesa…",
        mpSaveSettings: "💾 SALVA IMPOSTAZIONI",
        mpHostChangingSettings: "⚙️ L'host sta cambiando le impostazioni…",

        // LEADERBOARD
        lbMenuButton: "🏆 CLASSIFICA",
        lbTitle: "🏆 CLASSIFICA",
        lbSubtitle: "Il miglior punteggio di ogni giocatore — meno tentativi vince",
        lbAllTime: "Di sempre",
        lbWeekly: "Questa settimana",
        lbLoading: "Caricamento…",
        lbEmptyWeekly: "Nessuna vittoria questa settimana — vai a giocare!",
        lbEmptyAll: "Nessuna vittoria registrata — vai a giocare!",
        lbGuessSingular: "tentativo",
        lbGuessPlural: "tentativi",
        lbErrorLoad: "Impossibile caricare la classifica — controlla la connessione.",
        lbYouTag: "tu",
        lbYourRank: "La tua posizione",
        lbRankBeyond: "La tua posizione è oltre quello che possiamo mostrare qui — continua a scalare!",

        // DIFFICULTY SCREEN
        diffScreenTitle: "SCEGLI DIFFICOLTÀ",
        diffScreenSubtitle: "Quanto conosci il calcio?",
        easyDesc: "Calciatori famosi",
        mediumDesc: "Giocatori famosi e meno ovvi",
        hardDesc: "Conoscenza seria del calcio",
        legendsDesc: "Icone ritirate e GOATs",

        // SETTINGS
        settingsTitle: "⚙️ IMPOSTAZIONI",
        settingsSoundSection: "SUONO",
        settingsSounds: "Suoni",
        settingsOtherSection: "ALTRO",
        settingsMusic: "Musica",
        settingsSfx: "Effetti sonori",
        settingsVibration: "Vibrazione",
        settingsReset: "🗑️ REIMPOSTA PROGRESSO",
        settingsResetConfirm: "⚠️ TOCCA ANCORA PER CONFERMARE",
        settingsAbout: "INFORMAZIONI SUL GIOCO",
        settingsMadeBy: "Creato da Vanitas",
        settingsWhoIsVanitas: "🙋 Chi è Vanitas?",
        settingsSupportKofi: "☕ Sostieni su Ko-fi",

        // NICKNAME PROMPT
        nickTitle: "👋 Come ti chiamiamo?",
        nickSubtitle: "Il tuo nickname è salvato su questo dispositivo e appare in classifica.",
        nickPlaceholder: "Inserisci un nickname",
        nickSubmit: "Giochiamo"
    },

    ja: {
        name: "日本語",
        flag: "jp",

        tagline: "究極のサッカー選手当てゲーム",
        play: "🎮 プレイ",
        daily: "🔥 デイリーチャレンジ",
        stats: "📊 統計",
        howToPlay: "❓ 遊び方",
        footer: "選手を当てて、ゲームを極めよう。",

        easy: "イージー",
        medium: "ミディアム",
        hard: "ハード",
        legends: "レジェンド",
        attempts: "回",

        dailyLabel: "🔥 デイリー",
        attemptsLeft: "回 残り",

        search: "サッカー選手を検索...",
        gameTitle: "誰が選手？",
        gameSubtitle: "謎のサッカー選手を当てよう",
        backMenu: "← メニュー",
        guess: "予想",
        hint: "💡 ヒント",
        hintUsed: "💡 使用済み",
        giveUp: "🏳️ ギブアップ",
        share: "📋 結果を共有",

        player: "選手",
        country: "国",
        club: "クラブ",
        league: "リーグ",
        position: "ポジション",
        age: "年齢",
        foot: "利き足",

        games: "ゲーム数",
        wins: "勝利",
        winRate: "勝率",
        streak: "連勝",
        dailyStreak: "デイリー連勝",
        achievements: "実績",

        howTitle: "❓ 遊び方",
        how1: "検索ボックスを使って謎のサッカー選手を当ててください。候補から名前を選びます。",
        how2: "各予想ではヒントが表示されます：緑 = 正解、黄色 = 近い、赤 = 不正解。",
        how3: "年齢では矢印が本当の選手が年上 ⬆️ か年下 ⬇️ かを示します。",
        how4: "難易度を選択してください。イージーは試行回数が多く、難しくなるほど少なくなります。",
        how5: "🔥 デイリーチャレンジでは、全員が1日1回同じ選手に挑戦します。",
        how6: "💡 困ったときは1ゲームにつき1回無料ヒントを使えます。",
        how7: "📋 ゲーム終了後、絵文字グリッドで結果を共有できます。",
        how8: "🏆 特別な条件を達成して実績を解除しましょう。",

        chooseSuggestion: "❌ 候補からサッカー選手を選んでください。",
        amazing: "🎉 すごい！ {player} を見つけました！",
        gameOver: "😢 ゲームオーバー！選手は {player} でした。",
        notThisOne: "❌ 違います！残り {amount} 回です。",
        gaveUp: "🏳️ ギブアップしました。選手は {player} でした。",
        copied: "📋 結果をクリップボードにコピーしました！",

        dailySolved: "✅ 今日のチャレンジをクリアしました！",
        dailyAttempted: "❌ 今日のチャレンジに挑戦しました。",
        alreadyPlayed: "🔥 今日のデイリーチャレンジはすでにプレイ済みです！明日また新しい選手に挑戦してください。",

        hintNormal: "💡 この選手は {flag} {country} 出身で、{league} でプレーしています。",
        hintLegend: "💡 この選手は {flag} {country} 出身で、{league} でプレーしていました。",
        hintPlaysFor: "所属:",
        hintUsedToPlayFor: "元所属:",
        hintFooted: "{foot}足",
        footLeft: "左",
        footRight: "右",
        posGoalkeeper: "ゴールキーパー",
        posDefender: "ディフェンダー",
        posMidfielder: "ミッドフィールダー",
        posWinger: "ウィンガー",
        posForward: "フォワード",

        achievementUnlocked: "実績解除",
        locked: "ロック中 — ",

        // MULTIPLAYER
        mpMenuTitle: "👥 マルチプレイヤー",
        mpMenuSubtitle: "友達と競って謎のサッカー選手を先に当てよう",
        mpCreateParty: "🎉 パーティーを作成",
        mpJoinParty: "🔑 パーティーに参加",
        mpBack: "← 戻る",

        mpCreatePartyTitle: "🎉 パーティーを作成",
        mpCreatePartySubtitle: "パーティーの部屋を設定しましょう",
        mpDifficultyLabel: "難易度",
        mpRoundsLabel: "ラウンド数",
        mpHintsLabel: "ヒント（プレイヤーごと、ラウンドごと）",
        mpHintsOff: "🚫 なし",
        mpPrivacyLabel: "公開設定",
        mpPillEasy: "🟢 イージー",
        mpPillMedium: "🟡 ミディアム",
        mpPillHard: "🔴 ハード",
        mpPillLegends: "🟣 レジェンド",
        mpPublic: "🌐 公開",
        mpPrivate: "🔒 非公開",
        mpPasswordPlaceholder: "パーティーのパスワード",
        mpCreateButton: "パーティーを作成",
        mpErrorNickname: "先にニックネームを選んでください。",
        mpErrorPassword: "パスワードを入力するか、公開に切り替えてください。",

        mpJoinPartyTitle: "🔑 パーティーに参加",
        mpJoinPartySubtitle: "友達から共有されたコードを入力してください",
        mpPartyCodeLabel: "パーティーコード",
        mpPasswordLabel: "パスワード（非公開の場合）",
        mpPasswordLeaveBlank: "公開の場合は空欄のままにしてください",
        mpJoinButton: "参加",
        mpErrorCode: "5文字のパーティーコードを入力してください。",
        mpConnecting: "接続中…",
        mpNoResponse: "そのパーティーからの応答がありません。コードを確認して再試行してください。",
        mpWrongPassword: "パスワードが間違っています。",
        mpAlreadyStarted: "そのパーティーはすでにゲームが始まっています。",
        mpCouldntJoin: "そのパーティーに参加できませんでした。",

        mpLobbyTitle: "🎉 パーティーロビー",
        mpCodeLabel: "コード",
        mpCopyButton: "📋 コピー",
        mpCopied: "✅ コピーしました",
        mpStartGame: "▶ ゲーム開始",
        mpNeedTwoPlayers: "開始するには最低2人必要です。",
        mpWaitingForHost: "ホストがゲームを開始するのを待っています…",
        mpYouSuffix: "（あなた）",
        mpHostBadge: "ホスト",
        mpLeaveParty: "← パーティーを退出",
        mpRoundWord: "ラウンド",
        mpRoundsWord: "ラウンド",

        mpRoundInfo: "ラウンド {round} / {total}",
        mpHostDisconnected: "⚠️ ホストが切断しました。",
        mpFoundFirst: "🎉 すごい！{player} を最初に見つけました！",
        mpOutOfAttempts: "⏳ 試行回数がなくなりました — 他のプレイヤーを待っています…",

        mpWonRound: "🎉 このラウンドに勝ちました！",
        mpPlayerWonRound: "{nickname} がラウンドに勝ちました",
        mpNobodyGotIt: "誰も当てられませんでした！",
        mpPlayerWas: "選手は {player} でした。",
        mpFinalResultsComing: "最終結果はまもなく…",
        mpRoundStartingSoon: "ラウンド {round} はまもなく開始…",
        mpPointSingular: "pt",
        mpPointPlural: "pt",
        mpPlayerDefaultName: "プレイヤー",

        mpPartyResults: "🏆 パーティー結果",
        mpBackToMenu: "メニューに戻る",
        mpRematch: "🔁 再戦",
        mpChangeSettings: "⚙️ 設定を変更",
        mpRematchStatus: "{voted}/{total} 準備完了 — 待機中…",
        mpSaveSettings: "💾 設定を保存",
        mpHostChangingSettings: "⚙️ ホストが設定を変更中…",

        // LEADERBOARD
        lbMenuButton: "🏆 ランキング",
        lbTitle: "🏆 ランキング",
        lbSubtitle: "各プレイヤーの自己ベスト — 予想回数が少ないほど上位",
        lbAllTime: "全期間",
        lbWeekly: "今週",
        lbLoading: "読み込み中…",
        lbEmptyWeekly: "今週の勝利はまだありません — プレイしよう！",
        lbEmptyAll: "勝利の記録がまだありません — プレイしよう！",
        lbGuessSingular: "回",
        lbGuessPlural: "回",
        lbErrorLoad: "ランキングを読み込めませんでした — 接続を確認してください。",
        lbYouTag: "あなた",
        lbYourRank: "あなたの順位",
        lbRankBeyond: "あなたの順位はここに表示できる範囲を超えています — その調子で頑張って！",

        // DIFFICULTY SCREEN
        diffScreenTitle: "難易度を選択",
        diffScreenSubtitle: "サッカーの知識はどのくらいですか？",
        easyDesc: "有名なサッカー選手",
        mediumDesc: "有名な選手とやや知られた選手",
        hardDesc: "本格的なサッカー知識",
        legendsDesc: "引退した伝説とGOAT",

        // SETTINGS
        settingsTitle: "⚙️ 設定",
        settingsSoundSection: "サウンド",
        settingsSounds: "サウンド",
        settingsOtherSection: "その他",
        settingsMusic: "ミュージック",
        settingsSfx: "効果音",
        settingsVibration: "バイブレーション",
        settingsReset: "🗑️ 進行状況をリセット",
        settingsResetConfirm: "⚠️ もう一度タップして確認",
        settingsAbout: "このゲームについて",
        settingsMadeBy: "Vanitas 制作",
        settingsWhoIsVanitas: "🙋 Vanitas とは？",
        settingsSupportKofi: "☕ Ko-fi で支援",

        // NICKNAME PROMPT
        nickTitle: "👋 なんてお呼びしましょう？",
        nickSubtitle: "ニックネームはこの端末に保存され、リーダーボードに表示されます。",
        nickPlaceholder: "ニックネームを入力",
        nickSubmit: "プレイする"
    }
};


// ------------------------------------------
// CURRENT LANGUAGE
// ------------------------------------------

let currentLanguage =
    localStorage.getItem("footdleLanguage") || "en";

if (!FOOTDLE_LANGUAGES[currentLanguage]) {
    currentLanguage = "en";
}


// ------------------------------------------
// TRANSLATION HELPER
// ------------------------------------------

function t(key, replacements = {}) {

    const lang = FOOTDLE_LANGUAGES[currentLanguage];

    let text = lang[key] || FOOTDLE_LANGUAGES.en[key] || key;

    Object.keys(replacements).forEach(key => {
        text = text.replace(
            `{${key}}`,
            replacements[key]
        );
    });

    return text;
}


function tPosition(pos) {
    const key = "pos" + pos;
    const out = t(key);
    return out !== key ? out : pos;
}


// ------------------------------------------
// CREATE LANGUAGE SELECTOR
// ------------------------------------------

function createLanguageSelector() {

    if (document.getElementById("languageSelector")) return;

    const wrapper = document.createElement("div");

    wrapper.id = "languageSelector";
    wrapper.className = "language-selector";

    wrapper.innerHTML = `
        <button id="languageButton" class="language-button">
            🌐 <span id="languageCurrent">EN</span>
        </button>

        <div id="languageMenu" class="language-menu">

            <button data-lang="en">
                <img src="https://flagcdn.com/24x18/gb.png" class="language-flag" alt="">
                English
            </button>

            <button data-lang="fr">
                <img src="https://flagcdn.com/24x18/fr.png" class="language-flag" alt="">
                Français
            </button>

            <button data-lang="ar">
                <img src="https://flagcdn.com/24x18/ma.png" class="language-flag" alt="">
                العربية
            </button>

            <button data-lang="es">
                <img src="https://flagcdn.com/24x18/es.png" class="language-flag" alt="">
                Español
            </button>

            <button data-lang="it">
                <img src="https://flagcdn.com/24x18/it.png" class="language-flag" alt="">
                Italiano
            </button>

            <button data-lang="ja">
                <img src="https://flagcdn.com/24x18/jp.png" class="language-flag" alt="">
                日本語
            </button>

        </div>
    `;

    document.body.appendChild(wrapper);

    const languageButton =
        document.getElementById("languageButton");

    const languageMenu =
        document.getElementById("languageMenu");

    languageButton.addEventListener("click", function(event) {
        event.stopPropagation();
        languageMenu.classList.toggle("open");
    });

    languageMenu
        .querySelectorAll("button")
        .forEach(button => {

            button.addEventListener("click", function(event) {

                event.stopPropagation();

                const lang = this.dataset.lang;

                changeLanguage(lang);

                languageMenu.classList.remove("open");

            });

        });
}

// ------------------------------------------
// CHANGE LANGUAGE
// ------------------------------------------

function changeLanguage(language) {

    if (!FOOTDLE_LANGUAGES[language]) return;

    currentLanguage = language;

    localStorage.setItem(
        "footdleLanguage",
        language
    );

    applyLanguage();

}


// ------------------------------------------
// APPLY LANGUAGE
// ------------------------------------------

function applyLanguage() {

    const lang = FOOTDLE_LANGUAGES[currentLanguage];

    document.documentElement.lang = currentLanguage;

    document.documentElement.dir =
        currentLanguage === "ar" ? "rtl" : "ltr";

    const current = document.getElementById("languageCurrent");

    if (current) {
        current.textContent =
            currentLanguage.toUpperCase();
    }


    // MAIN MENU

    const tagline =
        document.querySelector(".tagline");

    if (tagline) tagline.textContent = lang.tagline;


    const mainButtons =
        document.querySelectorAll("#menuScreen .secondary-button");

    if (mainButtons[0]) mainButtons[0].textContent = lang.daily;
    if (mainButtons[1]) mainButtons[1].textContent = lang.stats;
    if (mainButtons[2]) mainButtons[2].textContent = lang.howToPlay;


    const playButton =
        document.querySelector("#menuScreen .main-button");

    if (playButton) playButton.textContent = lang.play;


    const footer =
        document.querySelector(".menu-footer");

    if (footer) footer.textContent = lang.footer;


    // DIFFICULTY SCREEN

    const diffScreenTitle =
        document.querySelector("#difficultyScreen h2");

    if (diffScreenTitle) diffScreenTitle.textContent = lang.diffScreenTitle;

    const diffScreenSubtitle =
        document.querySelector("#difficultyScreen .difficulty-subtitle");

    if (diffScreenSubtitle) diffScreenSubtitle.textContent = lang.diffScreenSubtitle;

    const difficultyCards =
        document.querySelectorAll("#difficultyScreen .difficulty-card");

    const difficultyNames = [
        lang.easy,
        lang.medium,
        lang.hard,
        lang.legends
    ];

    const difficultyDescs = [
        lang.easyDesc,
        lang.mediumDesc,
        lang.hardDesc,
        lang.legendsDesc
    ];

    difficultyCards.forEach((card, index) => {

        const title = card.querySelector("h3");
        const desc = card.querySelector("p");
        const small = card.querySelector("small");

        if (title && difficultyNames[index]) {
            title.textContent = difficultyNames[index];
        }

        if (desc && difficultyDescs[index]) {
            desc.textContent = difficultyDescs[index];
        }

        if (small) {

            const attemptsNumber = [7, 5, 3, 4][index];

            small.textContent =
                `${attemptsNumber} ${lang.attempts}`;

        }

    });


    // GAME SCREEN

    const difficultyLabel =
        document.getElementById("difficultyLabel");

    if (difficultyLabel) {

        if (isDaily) {
            difficultyLabel.textContent = lang.dailyLabel;
        } else {
            difficultyLabel.textContent =
                lang[difficulty] || difficulty.toUpperCase();
        }

    }

        // GAME SCREEN — back button, title, subtitle, attempts counter
    const backBtnEl = document.querySelector("#gameScreen .back-small");
    if (backBtnEl) backBtnEl.textContent = lang.backMenu;

    const gameTitleEl = document.querySelector("#gameScreen .game-title h1");
    if (gameTitleEl) gameTitleEl.textContent = lang.gameTitle;

    const gameSubtitleEl = document.querySelector("#gameScreen .game-title p");
    if (gameSubtitleEl) gameSubtitleEl.textContent = lang.gameSubtitle;

    const attemptsTextEl = document.querySelector("#gameScreen .attempt-counter");
    if (attemptsTextEl) {
        const num = document.getElementById("attemptsLeft");
        if (num) {
            attemptsTextEl.innerHTML =
                `<span id="attemptsLeft">${num.textContent}</span> ${lang.attemptsLeft}`;
        }
    }

    const playerInput =
        document.getElementById("playerInput");

    if (playerInput) {
        playerInput.placeholder = lang.search;
    }


    const guessButton =
        document.querySelector("#gameScreen .search-box button");

    if (guessButton) {
        guessButton.textContent = lang.guess;
    }


    const hintButton =
        document.getElementById("hintButton");

    if (hintButton && hintsUsed < maxHints) {
    const left = maxHints - hintsUsed;
    hintButton.textContent = `${t("hint")} (${left})`;
}


    const giveUpButton =
        document.querySelector(".action-button.giveup");

    if (giveUpButton) {
        giveUpButton.textContent = lang.giveUp;
    }


    const shareButton =
        document.getElementById("shareButton");

    if (shareButton) {
        shareButton.textContent = lang.share;
    }


    // GAME HEADERS

    const headers =
        document.querySelectorAll("#gameScreen .clue-headers > div")

    const headerNames = [
        lang.player,
        lang.country,
        lang.club,
        lang.league,
        lang.position,
        lang.age,
        lang.foot
    ];

    headers.forEach((header, index) => {

        if (headerNames[index]) {
            header.textContent = headerNames[index];
        }

    });


    // STATS

    const statCards =
        document.querySelectorAll("#statsScreen .stat-card");

    const statNames = [
        lang.games,
        lang.wins,
        lang.winRate,
        lang.streak,
        lang.dailyStreak
    ];

    statCards.forEach((card, index) => {

        const label = card.querySelector("span, p, .stat-label");

        if (label && statNames[index]) {
            label.textContent = statNames[index];
        }

    });


    // ACHIEVEMENTS TITLE

    const achievementsTitle =
        document.querySelector("#statsScreen h3");

    if (achievementsTitle) {
        achievementsTitle.textContent =
            "🏆 " + lang.achievements;
    }


    // HOW TO PLAY

    const modalTitle =
        document.querySelector("#howToPlayModal h2");

    if (modalTitle) {
        modalTitle.textContent = lang.howTitle;
    }

    const howItems =
        document.querySelectorAll(".howto-list li");

    const howKeys = [
        "how1",
        "how2",
        "how3",
        "how4",
        "how5",
        "how6",
        "how7",
        "how8"
    ];

    howItems.forEach((item, index) => {

        if (howKeys[index]) {
            item.textContent = lang[howKeys[index]];
        }

    });


    // DAILY BADGE

    updateDailyBadgeTranslated();


    // ACHIEVEMENTS

    renderAchievements();


    // MULTIPLAYER + LEADERBOARD + SETTINGS

    applyMultiplayerLanguage();
    applyLeaderboardLanguage();
    applyNicknameLanguage();
    applySettingsLanguage();
    applyVanitasBioLanguage();

}


// ------------------------------------------
// MULTIPLAYER LANGUAGE
// ------------------------------------------

function applyMultiplayerLanguage() {

    const lang = FOOTDLE_LANGUAGES[currentLanguage];


    // MULTIPLAYER MENU

    const mpMenuButton =
        document.querySelector("#multiplayerScreen h2");

    if (mpMenuButton) mpMenuButton.textContent = lang.mpMenuTitle;

    const mpMainMenuButton =
        document.querySelector("#menuScreen .multiplayer-button");

    if (mpMainMenuButton) mpMainMenuButton.textContent = lang.mpMenuTitle;

    const mpMenuSubtitle =
        document.querySelector("#multiplayerScreen .difficulty-subtitle");

    if (mpMenuSubtitle) mpMenuSubtitle.textContent = lang.mpMenuSubtitle;

    const mpCreateBtn =
        document.querySelector("#multiplayerScreen .main-button:not(.mp-join-button)");

    if (mpCreateBtn) mpCreateBtn.textContent = lang.mpCreateParty;

    const mpJoinBtn =
        document.querySelector("#multiplayerScreen .mp-join-button");

    if (mpJoinBtn) mpJoinBtn.textContent = lang.mpJoinParty;

    document.querySelectorAll(
        "#multiplayerScreen .back-button, #createPartyScreen .back-button, #joinPartyScreen .back-button"
    ).forEach(btn => { btn.textContent = lang.mpBack; });


    // CREATE PARTY SCREEN

    const createTitle =
        document.querySelector("#createPartyScreen h2");

    if (createTitle) createTitle.textContent = lang.mpCreatePartyTitle;

    const createSubtitle =
        document.querySelector("#createPartyScreen .difficulty-subtitle");

    if (createSubtitle) createSubtitle.textContent = lang.mpCreatePartySubtitle;

    const createLabels =
        document.querySelectorAll("#createPartyScreen .mp-label");

    if (createLabels[0]) createLabels[0].textContent = lang.mpDifficultyLabel;
    if (createLabels[1]) createLabels[1].textContent = lang.mpRoundsLabel;
    if (createLabels[2]) createLabels[2].textContent = lang.mpHintsLabel;
    if (createLabels[3]) createLabels[3].textContent = lang.mpPrivacyLabel;

    const diffPills =
        document.querySelectorAll("#createPartyScreen .mp-difficulty-row [data-difficulty]");

    const pillNames = [
        lang.mpPillEasy,
        lang.mpPillMedium,
        lang.mpPillHard,
        lang.mpPillLegends
    ];

    diffPills.forEach((pill, i) => {
        if (pillNames[i]) pill.textContent = pillNames[i];
    });

        const hintPills =
        document.querySelectorAll("#mpHintsRow .mp-pill");

    if (hintPills[0]) hintPills[0].textContent = lang.mpHintsOff;

    const publicPill = document.getElementById("publicPill");
    if (publicPill) publicPill.textContent = lang.mpPublic;

    const privatePill = document.getElementById("privatePill");
    if (privatePill) privatePill.textContent = lang.mpPrivate;

    const partyPassword = document.getElementById("partyPassword");
    if (partyPassword) partyPassword.placeholder = lang.mpPasswordPlaceholder;

    const createPartyBtn =
        document.querySelector("#createPartyScreen .mp-form > .main-button");

    if (createPartyBtn) createPartyBtn.textContent = lang.mpCreateButton;


    // JOIN PARTY SCREEN

    const joinTitle =
        document.querySelector("#joinPartyScreen h2");

    if (joinTitle) joinTitle.textContent = lang.mpJoinPartyTitle;

    const joinSubtitle =
        document.querySelector("#joinPartyScreen .difficulty-subtitle");

    if (joinSubtitle) joinSubtitle.textContent = lang.mpJoinPartySubtitle;

    const joinLabels =
        document.querySelectorAll("#joinPartyScreen .mp-label");

    if (joinLabels[0]) joinLabels[0].textContent = lang.mpPartyCodeLabel;
    if (joinLabels[1]) joinLabels[1].textContent = lang.mpPasswordLabel;

    const joinPassword = document.getElementById("joinPartyPassword");
    if (joinPassword) joinPassword.placeholder = lang.mpPasswordLeaveBlank;

    const joinBtn = document.getElementById("joinPartyButton");
    if (joinBtn) joinBtn.textContent = lang.mpJoinButton;


    // PARTY LOBBY SCREEN

    const lobbyTitle =
        document.querySelector("#partyLobbyScreen h2");

    if (lobbyTitle) lobbyTitle.textContent = lang.mpLobbyTitle;

    const codeLabel =
        document.querySelector("#partyLobbyScreen .party-code-display span");

    if (codeLabel) codeLabel.textContent = lang.mpCodeLabel;

    const copyBtn = document.getElementById("copyCodeButton");
    if (copyBtn) copyBtn.textContent = lang.mpCopyButton;

    const startBtn = document.getElementById("startPartyButton");
    if (startBtn) startBtn.textContent = lang.mpStartGame;

    const leaveBtn =
        document.querySelector("#partyLobbyScreen .back-button");

    if (leaveBtn) leaveBtn.textContent = lang.mpLeaveParty;

    // GAME OVER OVERLAY

    const mpGameOverTitle = document.getElementById("mpGameOverTitle");
    if (mpGameOverTitle) mpGameOverTitle.textContent = lang.mpPartyResults;

    const mpGameOverBackButton = document.getElementById("mpGameOverBackButton");
    if (mpGameOverBackButton) mpGameOverBackButton.textContent = lang.mpBackToMenu;


    // Re-render anything already live in a multiplayer session
    // so it picks up the new language immediately.
    if (typeof mp !== "undefined" && mp.active) {

        if (typeof renderLobbyPlayers === "function") renderLobbyPlayers();
        if (typeof renderOpponentsPanel === "function") renderOpponentsPanel();

        const mpRoundInfo = document.getElementById("mpRoundInfo");
        if (mpRoundInfo && mpRoundInfo.style.display !== "none" && mp.round > 0) {
            mpRoundInfo.textContent = t("mpRoundInfo", { round: mp.round, total: mp.totalRounds });
        }

    }

}


// ------------------------------------------
// LEADERBOARD LANGUAGE
// ------------------------------------------

function applyLeaderboardLanguage() {

    const lang = FOOTDLE_LANGUAGES[currentLanguage];

    const lbMenuBtn = document.getElementById("leaderboardMenuButton");
    if (lbMenuBtn) lbMenuBtn.textContent = lang.lbMenuButton;

    const overlay = document.getElementById("leaderboardOverlay");
    if (!overlay) return;

    const title = overlay.querySelector(".leaderboard-title");
    if (title) title.textContent = lang.lbTitle;

    const subtitle = overlay.querySelector(".leaderboard-subtitle");
    if (subtitle) subtitle.textContent = lang.lbSubtitle;

    const tabs = overlay.querySelectorAll(".leaderboard-tab");
    if (tabs[0]) tabs[0].textContent = lang.lbAllTime;
    if (tabs[1]) tabs[1].textContent = lang.lbWeekly;

    // Re-render the list itself so entries/empty-state text update too.
    if (overlay.classList.contains("show") && typeof loadLeaderboardList === "function") {
        loadLeaderboardList(overlay);
    }

}


// ------------------------------------------
// TRANSLATED DAILY BADGE
// ------------------------------------------

function updateDailyBadgeTranslated() {

    // The result now appears in a modal on click (openDailyStatusModal)
    // instead of as a persistent label under the button.

    const badge =
        document.getElementById("dailyStatus");

    if (!badge) return;

    badge.textContent = "";

}


// ------------------------------------------
// TRANSLATED ACHIEVEMENTS
// ------------------------------------------

function renderAchievementsTranslated() {

    const grid =
        document.getElementById("achievementsGrid");

    if (!grid) return;

    const unlocked =
        getUnlockedAchievements();

    grid.innerHTML = "";

    const translations = {
        first_win: {
            name: {
                en: "First Blood",
                fr: "Premier Sang",
                ar: "أول انتصار",
                es: "Primera Victoria",
                it: "Prima Vittoria",
                ja: "初勝利"
            },
            desc: {
                en: "Win your first game",
                fr: "Gagnez votre première partie",
                ar: "اربح أول مباراة",
                es: "Gana tu primera partida",
                it: "Vinci la tua prima partita",
                ja: "初めてゲームに勝つ"
            }
        },

        flawless: {
            name: {
                en: "Flawless Victory",
                fr: "Victoire parfaite",
                ar: "انتصار مثالي",
                es: "Victoria perfecta",
                it: "Vittoria perfetta",
                ja: "完璧な勝利"
            },
            desc: {
                en: "Win in a single guess",
                fr: "Gagnez en une seule tentative",
                ar: "اربح من محاولة واحدة",
                es: "Gana en un solo intento",
                it: "Vinci al primo tentativo",
                ja: "1回の予想で勝つ"
            }
        },

        clutch: {
            name: {
                en: "Clutch Save",
                fr: "Sauvetage in extremis",
                ar: "فوز في اللحظة الأخيرة",
                es: "Victoria decisiva",
                it: "Vittoria all'ultimo",
                ja: "土壇場の勝利"
            },
            desc: {
                en: "Win on your very last attempt",
                fr: "Gagnez lors de votre dernière tentative",
                ar: "اربح في آخر محاولة",
                es: "Gana en tu último intento",
                it: "Vinci all'ultimo tentativo",
                ja: "最後の予想で勝つ"
            }
        },

        hard_hero: {
            name: {
                en: "Hard Mode Hero",
                fr: "Héros du mode difficile",
                ar: "بطل الوضع الصعب",
                es: "Héroe del modo difícil",
                it: "Eroe della modalità difficile",
                ja: "ハードモードの英雄"
            },
            desc: {
                en: "Win on Hard difficulty",
                fr: "Gagnez en mode difficile",
                ar: "اربح في الوضع الصعب",
                es: "Gana en dificultad difícil",
                it: "Vinci in modalità difficile",
                ja: "ハードで勝利する"
            }
        },

        legend_master: {
            name: {
                en: "Legend Master",
                fr: "Maître des légendes",
                ar: "سيد الأساطير",
                es: "Maestro de leyendas",
                it: "Maestro delle leggende",
                ja: "レジェンドマスター"
            },
            desc: {
                en: "Win on Legends difficulty",
                fr: "Gagnez en mode Légendes",
                ar: "اربح في وضع الأساطير",
                es: "Gana en dificultad Leyendas",
                it: "Vinci in modalità Leggende",
                ja: "レジェンドで勝利する"
            }
        },

        sharp_mind: {
            name: {
                en: "Sharp Mind",
                fr: "Esprit vif",
                ar: "عقل حاد",
                es: "Mente brillante",
                it: "Mente brillante",
                ja: "鋭い頭脳"
            },
            desc: {
                en: "Win without using a hint",
                fr: "Gagnez sans utiliser d'indice",
                ar: "اربح بدون استخدام تلميح",
                es: "Gana sin usar una pista",
                it: "Vinci senza usare un indizio",
                ja: "ヒントを使わずに勝つ"
            }
        },

        daily_3: {
            name: {
                en: "Daily Devotee",
                fr: "Fidèle du quotidien",
                ar: "المخلص للتحدي اليومي",
                es: "Fan del desafío diario",
                it: "Fedele quotidiano",
                ja: "デイリーチャレンジャー"
            },
            desc: {
                en: "3-day Daily Challenge streak",
                fr: "Série de 3 jours au défi quotidien",
                ar: "سلسلة تحدي يومي لمدة 3 أيام",
                es: "Racha de 3 días en el desafío diario",
                it: "Serie di 3 giorni nella sfida quotidiana",
                ja: "デイリーチャレンジ3日連続"
            }
        },

        streak_5: {
            name: {
                en: "On Fire",
                fr: "En feu",
                ar: "متوهج",
                es: "En racha",
                it: "Inarrestabile",
                ja: "絶好調"
            },
                    quickfire: {
            name: {
                en: "Quickfire",
                fr: "Tir rapide",
                ar: "بسرعة البرق",
                es: "Fuego rápido",
                it: "Fuoco rapido",
                ja: "クイックファイア"
                }
            },
            desc: {
                en: "Win in 2 guesses or fewer",
                fr: "Gagnez en 2 tentatives ou moins",
                ar: "اربح في محاولتين أو أقل",
                es: "Gana en 2 intentos o menos",
                it: "Vinci in 2 tentativi o meno",
                ja: "2回以下の予想で勝つ"
          },

        iron_will: {
            name: {
                en: "Iron Will",
                fr: "Volonté de fer",
                ar: "إرادة حديدية",
                es: "Voluntad de hierro",
                it: "Volontà di ferro",
                ja: "鉄の意志"
            },
            desc: {
                en: "Win on Legends difficulty without using a hint",
                fr: "Gagnez en mode Légendes sans utiliser d'indice",
                ar: "اربح في وضع الأساطير بدون استخدام تلميح",
                es: "Gana en dificultad Leyendas sin usar una pista",
                it: "Vinci in modalità Leggende senza usare un indizio",
                ja: "レジェンドでヒントを使わずに勝つ"
            }
         },

        nine_lives: {
            name: {
                en: "Nine Lives",
                fr: "Neuf vies",
                ar: "تسع أرواح",
                es: "Nueve vidas",
                it: "Nove vite",
                ja: "九つの命"
            },
            desc: {
                en: "Win on Hard difficulty on your very last attempt",
                fr: "Gagnez en mode difficile à votre toute dernière tentative",
                ar: "اربح في الوضع الصعب في آخر محاولة",
                es: "Gana en dificultad difícil en tu último intento",
                it: "Vinci in modalità difficile all'ultimo tentativo",
                ja: "ハードで最後の予想で勝つ"
            }
         },

        grandmaster: {
            name: {
                en: "Grandmaster",
                fr: "Grand Maître",
                ar: "الأستاذ الكبير",
                es: "Gran Maestro",
                it: "Gran Maestro",
                ja: "グランドマスター"
            },
            desc: {
                en: "Guess a Legend correctly on your first try",
                fr: "Devinez une Légende du premier coup",
                ar: "خمن أسطورة بشكل صحيح من المحاولة الأولى",
                es: "Adivina una Leyenda en tu primer intento",
                it: "Indovina una Leggenda al primo tentativo",
                ja: "レジェンドを最初の予想で当てる"
            }
        },

        streak_10: {
            name: {
                en: "Unstoppable",
                fr: "Inarrêtable",
                ar: "لا يمكن إيقافه",
                es: "Imparable",
                it: "Implacabile",
                ja: "止まらない"
            },
            desc: {
                en: "10-game win streak",
                fr: "Série de 10 victoires",
                ar: "سلسلة من 10 انتصارات",
                es: "Racha de 10 victorias",
                it: "Serie di 10 vittorie",
                ja: "10連勝"
            }
         },

        streak_20: {
            name: {
                en: "Unbreakable",
                fr: "Incassable",
                ar: "لا يُكسر",
                es: "Irrompible",
                it: "Infrangibile",
                ja: "無敵"
            },
            desc: {
                en: "20-game win streak",
                fr: "Série de 20 victoires",
                ar: "سلسلة من 20 انتصاراً",
                es: "Racha de 20 victorias",
                it: "Serie di 20 vittorie",
                ja: "20連勝"
            }
        },

        daily_7: {
            name: {
                en: "Perfect Week",
                fr: "Semaine parfaite",
                ar: "أسبوع مثالي",
                es: "Semana perfecta",
                it: "Settimana perfetta",
                ja: "パーフェクトウィーク"
            },
            desc: {
                en: "7-day Daily Challenge streak",
                fr: "Série de 7 jours au défi quotidien",
                ar: "سلسلة تحدي يومي لمدة 7 أيام",
                es: "Racha de 7 días en el desafío diario",
                it: "Serie di 7 giorni nella sfida quotidiana",
                ja: "デイリーチャレンジ7日連続"
            }
        },

        daily_30: {
            name: {
                en: "Calendar Crusher",
                fr: "Briseur de calendrier",
                ar: "محطم التقويم",
                es: "Rompe calendarios",
                it: "Distruttore di calendari",
                ja: "カレンダークラッシャー"
            },
            desc: {
                en: "30-day Daily Challenge streak",
                fr: "Série de 30 jours au défi quotidien",
                ar: "سلسلة تحدي يومي لمدة 30 يوماً",
                es: "Racha de 30 días en el desafío diario",
                it: "Serie di 30 giorni nella sfida quotidiana",
                ja: "デイリーチャレンジ30日連続"
            }
        },

        veteran: {
            name: {
                en: "Veteran",
                fr: "Vétéran",
                ar: "محارب قديم",
                es: "Veterano",
                it: "Veterano",
                ja: "ベテラン"
            },
            desc: {
                en: "Win 50 games total",
                fr: "Gagnez 50 parties au total",
                ar: "اربح 50 مباراة إجمالاً",
                es: "Gana 50 partidas en total",
                it: "Vinci 50 partite in totale",
                ja: "合計50勝する"
            }
         },

        century: {
            name: {
                en: "Century Club",
                fr: "Club des cent",
                ar: "نادي المائة",
                es: "Club de los cien",
                it: "Club dei cento",
                ja: "センチュリークラブ"
            },
            desc: {
                en: "Win 100 games total",
                fr: "Gagnez 100 parties au total",
                ar: "اربح 100 مباراة إجمالاً",
                es: "Gana 100 partidas en total",
                it: "Vinci 100 partite in totale",
                ja: "合計100勝する"
            }
        }

        },
                streak_5: {
            name: {
                en: "On Fire",
                fr: "En feu",
                ar: "متوهج",
                es: "En racha",
                it: "Inarrestabile",
                ja: "絶好調"
            },

            desc: {
                en: "5-game win streak",
                fr: "Série de 5 victoires",
                ar: "سلسلة من 5 انتصارات",
                es: "Racha de 5 victorias",
                it: "Serie di 5 vittorie",
                ja: "5連勝"
            }
        }
    };

    ACHIEVEMENTS.forEach(a => {

        const isUnlocked =
            unlocked.includes(a.id);

        const card =
            document.createElement("div");

        card.className =
            "badge" + (isUnlocked ? " unlocked" : "");

        const data =
            translations[a.id];

        const name =
            data?.name?.[currentLanguage] ||
            a.name;

        const desc =
            data?.desc?.[currentLanguage] ||
            a.desc;

        const detailText =
            isUnlocked
                ? desc
                : t("locked") + desc;

        card.title = detailText;

        card.innerHTML =
            `<span class="badge-icon">${a.icon}</span>
             <span class="badge-name">${name}</span>`;

        card.addEventListener("click", () => {
            showAchievementDetail(a.icon, name, detailText);
        });

        grid.appendChild(card);

    });

}


// Replace the original achievement renderer with translated one.
renderAchievements = renderAchievementsTranslated;


// ------------------------------------------
// OVERRIDE DAILY BADGE
// ------------------------------------------

updateDailyBadge = updateDailyBadgeTranslated;

// ------------------------------------------
// TRANSLATED HINT
// ------------------------------------------

const originalUseHint = useHint;

useHint = function() {

    if (typeof mp !== "undefined" && mp.active) {
        mpUseHint();
        return;
    }

    originalUseHint();

};

// ------------------------------------------
// LANGUAGE CSS
// ------------------------------------------

const languageStyle =
    document.createElement("style");

languageStyle.textContent = `
    .language-selector {
        position: fixed;
        top: 18px;
        left: 18px;
        z-index: 100;
        font-family: inherit;
    }

    .language-button {
        height: 44px;
        padding: 0 14px;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(16, 23, 34, 0.90);
        color: white;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: 0.2s ease;
        backdrop-filter: blur(10px);
    }

    .language-button:hover {
        transform: translateY(-2px);
        border-color: rgba(61,139,253,0.55);
        background: rgba(25, 34, 48, 0.95);
        box-shadow: 0 0 0 1px rgba(61,139,253,0.25), 0 0 18px rgba(61,139,253,0.55);
    }

    .language-menu {
        position: absolute;
        top: 52px;
        left: 0;
        min-width: 175px;
        padding: 7px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(13, 19, 29, 0.98);
        box-shadow: 0 15px 40px rgba(0,0,0,0.45);
        display: none;
    }

    .language-menu.open {
        display: flex;
        flex-direction: column;
    }

    .language-menu button {
        width: 100%;
        padding: 10px 12px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: white;
        text-align: left;
        font-size: 14px;
        cursor: pointer;
        transition: 0.15s ease;
    }

    .language-menu button:hover {
        background: rgba(61,139,253,0.18);
    }

    html[dir="rtl"] .language-menu button {
        text-align: right;
    }

    @media (max-width: 500px) {
        .language-selector {
            top: 12px;
            left: 12px;
        }

        .language-button {
            height: 40px;
            padding: 0 11px;
            font-size: 13px;
        }

        .language-menu {
            top: 47px;
            min-width: 160px;
        }
    }
`;

document.head.appendChild(languageStyle);


// ------------------------------------------
// CLOSE LANGUAGE MENU WHEN CLICKING OUTSIDE
// ------------------------------------------

document.addEventListener("click", function(event) {

    const selector =
        document.getElementById("languageSelector");

    const menu =
        document.getElementById("languageMenu");

    if (
        selector &&
        menu &&
        !selector.contains(event.target)
    ) {
        menu.classList.remove("open");
    }

});


// ------------------------------------------
// LANGUAGE SWITCHING — MAIN MENU ONLY
// ------------------------------------------
// The language selector should only be usable from the main
// menu, never mid-game or inside multiplayer/stats screens.
// Rather than hooking every navigation function (including
// ones in multiplayer.js), we just watch #menuScreen's class
// list — whenever it stops/starts being "active", we hide or
// show the selector accordingly. This stays correct no matter
// which function triggered the screen change.
// ------------------------------------------

function updateLanguageSelectorVisibility() {

    const selector = document.getElementById("languageSelector");
    if (!selector) return;

    const menuScreen = document.getElementById("menuScreen");
    const onMainMenu = !!(menuScreen && menuScreen.classList.contains("active"));

    selector.style.display = onMainMenu ? "" : "none";

    if (!onMainMenu) {
        const menu = document.getElementById("languageMenu");
        if (menu) menu.classList.remove("open");
    }

}

function watchMenuScreenForLanguageSelector() {

    const menuScreen = document.getElementById("menuScreen");
    if (!menuScreen) return;

    const observer = new MutationObserver(updateLanguageSelectorVisibility);

    observer.observe(menuScreen, {
        attributes: true,
        attributeFilter: ["class"]
    });

    updateLanguageSelectorVisibility();

}


// ------------------------------------------
// START LANGUAGE SYSTEM
// ------------------------------------------

createLanguageSelector();

applyLanguage();

watchMenuScreenForLanguageSelector();


// ==========================================
// PLAYER NICKNAME
// ==========================================

function getNickname() {
    return localStorage.getItem("playerNickname") || null;
}

function setNickname(name) {

    const clean = name.trim().slice(0, 20);

    if (!clean) return false;

    localStorage.setItem("playerNickname", clean);

    updateNicknameBadge();

    return true;

}

function updateNicknameBadge() {

    const label = document.getElementById("nicknameLabel");

    if (label) {
        label.textContent = getNickname() || "";
    }

}

function createNicknameBadge() {

    if (document.getElementById("nicknameBadge")) return;

    const badge = document.createElement("button");

    badge.id = "nicknameBadge";
    badge.className = "nickname-badge";
    badge.innerHTML = `👤 <span id="nicknameLabel">${getNickname() || ""}</span>`;

    badge.addEventListener("click", () => {
        showNicknamePrompt(false);
    });

    document.body.appendChild(badge);

}

function showNicknamePrompt(isFirstVisit) {

    let overlay = document.getElementById("nicknameOverlay");

    if (!overlay) {

        overlay = document.createElement("div");
        overlay.id = "nicknameOverlay";
        overlay.className = "nickname-overlay";

        overlay.innerHTML = `
            <div class="nickname-card">
                <button class="nickname-close" aria-label="Close">✕</button>
                <div class="nickname-title"></div>
                <div class="nickname-subtitle"></div>
                <input id="nicknameInput" class="nickname-input" type="text" maxlength="20" autocomplete="off" />
                <div class="nickname-error" id="nicknameError"></div>
                <button id="nicknameSubmit" class="nickname-submit"></button>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector("#nicknameInput");
        const submitBtn = overlay.querySelector("#nicknameSubmit");
        const closeBtn = overlay.querySelector(".nickname-close");

                const errorEl = overlay.querySelector("#nicknameError");

        function clearError() {
            errorEl.textContent = "";
            errorEl.classList.remove("show");
        }

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.classList.add("show");
        }

        async function trySubmit() {

            const value = input.value.trim();

            if (!value) return;

            clearError();
            submitBtn.disabled = true;
            const originalLabel = submitBtn.textContent;
            submitBtn.textContent = "…";

            const taken = await isNicknameTaken(value);

            if (taken) {
                showError(t("nickTaken"));
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
                input.focus();
                input.select();
                return;
            }

            if (setNickname(value)) {
                overlay.classList.remove("show");
                overlay.classList.remove("blocking");
                clearError();
            }

            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;

        }

        submitBtn.addEventListener("click", trySubmit);

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") trySubmit();
        });
        
        input.addEventListener("input", clearError);

        closeBtn.addEventListener("click", () => {
            if (!overlay.classList.contains("blocking")) {
                overlay.classList.remove("show");
            }
        });

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay && !overlay.classList.contains("blocking")) {
                overlay.classList.remove("show");
            }
        });

    }

    const input = overlay.querySelector("#nicknameInput");
    const closeBtn = overlay.querySelector(".nickname-close");

    input.value = isFirstVisit ? "" : (getNickname() || "");

    closeBtn.style.display = isFirstVisit ? "none" : "block";

    overlay.classList.toggle("blocking", isFirstVisit);

    overlay.classList.add("show");

    applyNicknameLanguage();

    setTimeout(() => input.focus(), 50);

}


// ------------------------------------------
// NICKNAME PROMPT LANGUAGE
// ------------------------------------------

function applyNicknameLanguage() {

    const overlay = document.getElementById("nicknameOverlay");

    if (!overlay) return;

    const title = overlay.querySelector(".nickname-title");
    const subtitle = overlay.querySelector(".nickname-subtitle");
    const input = overlay.querySelector("#nicknameInput");
    const submit = overlay.querySelector("#nicknameSubmit");

    if (title) title.textContent = t("nickTitle");
    if (subtitle) subtitle.textContent = t("nickSubtitle");
    if (input) input.placeholder = t("nickPlaceholder");
    if (submit) submit.textContent = t("nickSubmit");

}


// ------------------------------------------
// SETTINGS MODAL LANGUAGE
// ------------------------------------------

function applySettingsLanguage() {

    const modal = document.getElementById("settingsModal");
    if (!modal) return;

    // Modal title
    const modalTitle = modal.querySelector("h2");
    if (modalTitle) modalTitle.textContent = t("settingsTitle");

    // Section titles: SOUND, OTHER, ABOUT THIS GAME
    const sectionTitles = modal.querySelectorAll(".settings-section-title");
    sectionTitles.forEach(el => {
        if (!el.dataset.i18n) {
            const text = el.textContent.trim().toUpperCase();
            if (text === "SOUND") el.dataset.i18n = "sound";
            else if (text === "OTHER") el.dataset.i18n = "other";
            else if (text === "ABOUT THIS GAME") el.dataset.i18n = "about";
        }
        if (el.dataset.i18n === "sound") el.textContent = t("settingsSoundSection");
        else if (el.dataset.i18n === "other") el.textContent = t("settingsOtherSection");
        else if (el.dataset.i18n === "about") el.textContent = t("settingsAbout");
    });

    // Row labels: Music, Sound Effects, Vibration
    const rowLabels = modal.querySelectorAll(".settings-row-label > span:not(.settings-row-icon)");
    rowLabels.forEach(el => {
        if (!el.dataset.i18n) {
            const text = el.textContent.trim();
            if (text === "Music") el.dataset.i18n = "music";
            else if (text === "Sound Effects") el.dataset.i18n = "sfx";
            else if (text === "Vibration") el.dataset.i18n = "vibration";
        }
        if (el.dataset.i18n === "music") el.textContent = t("settingsMusic");
        else if (el.dataset.i18n === "sfx") el.textContent = t("settingsSfx");
        else if (el.dataset.i18n === "vibration") el.textContent = t("settingsVibration");
    });
    // About-this-game section
    const madeByLabel = document.getElementById("madeByLabel");
    if (madeByLabel) madeByLabel.textContent = t("settingsMadeBy");

    const bioBtn = document.getElementById("vanitasBioButton");
    if (bioBtn) bioBtn.textContent = t("settingsWhoIsVanitas");

    const kofiLink = document.getElementById("vanitasKofiLink");
    if (kofiLink) kofiLink.textContent = t("settingsSupportKofi");

    // Reset button (only when not in confirm state)
    const soundToggle = modal.querySelector("#soundToggleButton");
    if (soundToggle) {
        const label = soundToggle.querySelector("span");
        if (label) label.textContent = "🔊 " + t("settingsSounds");
    }

    const resetBtn = document.getElementById("resetProgressButton");
    if (resetBtn && !resetBtn.classList.contains("confirming")) {
        resetBtn.textContent = t("settingsReset");
    }

}


const nicknameStyle = document.createElement("style");

nicknameStyle.textContent = `
    .nickname-badge {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 100;
        height: 44px;
        padding: 0 14px;
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(16, 23, 34, 0.90);
        color: white;
        font-size: 14px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        transition: 0.2s ease;
        backdrop-filter: blur(10px);
    }

    .nickname-badge:hover {
        transform: translateY(-2px);
        border-color: rgba(61,139,253,0.55);
        background: rgba(25, 34, 48, 0.95);
        box-shadow: 0 0 0 1px rgba(61,139,253,0.25), 0 0 18px rgba(61,139,253,0.55);
    }

    .nickname-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        z-index: 400;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }

    .nickname-overlay.show {
        display: flex;
    }

    .nickname-card {
        position: relative;
        background: rgba(16, 23, 34, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 32px 28px 28px;
        max-width: 340px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .nickname-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.08);
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: 0.2s ease;
    }

    .nickname-close:hover {
        background: rgba(255, 255, 255, 0.18);
    }

    .nickname-title {
        font-size: 19px;
        font-weight: 700;
        color: white;
        margin-bottom: 8px;
    }

    .nickname-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 18px;
        line-height: 1.4;
    }

    .nickname-input {
        width: 100%;
        box-sizing: border-box;
        height: 46px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
        color: white;
        font-size: 15px;
        font-family: inherit;
        margin-bottom: 14px;
    }

    .nickname-input:focus {
        outline: none;
        border-color: rgba(61, 139, 253, 0.6);
    }

    .nickname-submit {
        width: 100%;
        height: 46px;
        border-radius: 10px;
        border: none;
        background: #3d8bfd;
        color: white;
        font-size: 15px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        transition: 0.2s ease;
    }

    .nickname-submit:hover {
        background: #5a9dfe;
    }

        .nickname-error {
        display: none;
        color: #ff6b7d;
        font-size: 12.5px;
        line-height: 1.4;
        margin: -6px 0 12px;
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(184, 50, 69, 0.12);
        border: 1px solid rgba(184, 50, 69, 0.4);
        text-align: center;
    }

    .nickname-error.show {
        display: block;
    }

    @media (max-width: 500px) {

        .nickname-badge {
            top: 12px;
            right: 12px;
            height: 40px;
            padding: 0 11px;
            font-size: 13px;
        }

    }
`;

document.head.appendChild(nicknameStyle);


// ------------------------------------------
// START NICKNAME SYSTEM
// ------------------------------------------

createNicknameBadge();

if (!getNickname()) {
    showNicknamePrompt(true);
}


// ==========================================
// LEADERBOARD
// ==========================================

// ==========================================
// LEADERBOARD (Supabase)
// ==========================================
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
}

const SUPABASE_URL = "https://eimkkncewgxfyonssiyn.supabase.co";
const SUPABASE_KEY = "sb_publishable_8tSkLBH-oqFtQDb2EUwdYA_UafG6PGZ";

async function isNicknameTaken(nickname) {

    const trimmed = nickname.trim();
    if (!trimmed) return false;

    // Allow keeping your own existing nickname.
    const current = getNickname();
    if (current && current.toLowerCase() === trimmed.toLowerCase()) {
        return false;
    }

    try {

        const endpoint =
            `${SUPABASE_URL}/rest/v1/leaderboard` +
            `?select=nickname` +
            `&nickname=ilike.${encodeURIComponent(trimmed)}` +
            `&limit=1`;

        const response = await fetch(endpoint, {
            headers: { "apikey": SUPABASE_KEY }
        });

        // Fail-open: if the network is down, don't lock the user out.
        if (!response.ok) return false;

        const rows = await response.json();
        return rows.length > 0;

    } catch (e) {
        return false;
    }

}

// We fetch a much bigger batch than we display (LB_FETCH_LIMIT) so that
// after collapsing repeat winners down to their single best run
// (see dedupeLeaderboardEntries), we still have a full top 10 — and enough
// data to work out the current player's own rank if they're outside it.
const LB_FETCH_LIMIT = 500;

async function fetchLeaderboardEntries(scope) {

    let endpoint =
        `${SUPABASE_URL}/rest/v1/leaderboard` +
        `?select=nickname,attempts,difficulty,time_seconds,created_at` +
        `&order=attempts.asc,time_seconds.asc.nullslast,created_at.asc` +
        `&limit=${LB_FETCH_LIMIT}`;

    if (scope === "weekly") {

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        endpoint += `&created_at=gte.${encodeURIComponent(weekAgo)}`;

    }

    const response = await fetch(endpoint, {
        headers: {
            "apikey": SUPABASE_KEY
        }
    });

    if (!response.ok) {
        throw new Error("Leaderboard fetch failed: " + response.status);
    }

    return response.json();

}

// Collapses a nickname's multiple wins down to their single best run
// (fewest guesses, fastest time as a tiebreaker — the list is already
// sorted that way, so the first row we see per nickname is their best).
// Also counts up how many wins that nickname has in this batch, so we
// can show a small "x N wins" badge.
function dedupeLeaderboardEntries(entries) {

    const seen = new Map();

    for (const entry of entries) {

        const key = entry.nickname.trim().toLowerCase();

        if (seen.has(key)) {
            seen.get(key).wins += 1;
            continue;
        }

        seen.set(key, { ...entry, wins: 1 });

    }

    return [...seen.values()];

}

async function recordLeaderboardEntry(attemptsUsed, gameDifficulty, timeSeconds) {

    const nickname = getNickname() || "Anonymous";

    try {

        await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                nickname,
                attempts: attemptsUsed,
                difficulty: gameDifficulty,
                time_seconds: timeSeconds ?? null
            })
        });

    } catch (e) {
        // Network error — silently skip. The win still counts locally
        // (stats/achievements), it just won't reach the shared leaderboard.
    }

}

function injectLeaderboardMenuButton() {

    if (document.getElementById("leaderboardMenuButton")) return;

    const menuScreen = document.getElementById("menuScreen");

    if (!menuScreen) return;

    const secondaryButtons = menuScreen.querySelectorAll(".secondary-button");

    const btn = document.createElement("button");

    btn.id = "leaderboardMenuButton";
    btn.className = "secondary-button";
    btn.textContent = t("lbMenuButton");

    btn.addEventListener("click", showLeaderboard);

    if (secondaryButtons.length > 0) {
        secondaryButtons[secondaryButtons.length - 1].insertAdjacentElement("afterend", btn);
    } else {
        menuScreen.appendChild(btn);
    }

}

let leaderboardScope = "all";

async function showLeaderboard() {

    let overlay = document.getElementById("leaderboardOverlay");

    if (!overlay) {

        overlay = document.createElement("div");
        overlay.id = "leaderboardOverlay";
        overlay.className = "leaderboard-overlay";

        overlay.innerHTML = `
            <div class="leaderboard-card">
                <button class="leaderboard-close" aria-label="Close">✕</button>
                <div class="leaderboard-title">${t("lbTitle")}</div>
                <div class="leaderboard-subtitle">${t("lbSubtitle")}</div>
                <div class="leaderboard-tabs">
                    <button class="leaderboard-tab active" data-scope="all">${t("lbAllTime")}</button>
                    <button class="leaderboard-tab" data-scope="weekly">${t("lbWeekly")}</button>
                </div>
                <div id="leaderboardList" class="leaderboard-list"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector(".leaderboard-close").addEventListener("click", () => {
            overlay.classList.remove("show");
        });

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.classList.remove("show");
        });

        overlay.querySelectorAll(".leaderboard-tab").forEach(tab => {

            tab.addEventListener("click", () => {

                if (tab.classList.contains("active")) return;

                overlay.querySelectorAll(".leaderboard-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");

                leaderboardScope = tab.dataset.scope;

                loadLeaderboardList(overlay);

            });

        });

    }

    overlay.classList.add("show");

    loadLeaderboardList(overlay);

}

function renderLeaderboardRow(entry, rank, myNickname) {

    const medals = ["🥇", "🥈", "🥉"];
    const isMe = myNickname && entry.nickname.trim().toLowerCase() === myNickname.trim().toLowerCase();

    return `
        <div class="leaderboard-row ${isMe ? "me" : ""} ${rank <= 3 ? "rank-" + rank : ""}">
            <span class="leaderboard-rank">${rank <= 3 ? medals[rank - 1] : rank}</span>
            <span class="leaderboard-name">
                ${escapeHtml(entry.nickname)}${isMe ? ` <span class="leaderboard-you">· ${t("lbYouTag")}</span>` : ""}
            </span>
            <span class="leaderboard-difficulty">${escapeHtml(entry.difficulty)}</span>
            <span class="leaderboard-meta">
                ${entry.wins > 1 ? `<span class="leaderboard-wins">🏆×${entry.wins}</span>` : ""}
                <span class="leaderboard-attempts">${entry.attempts} ${entry.attempts === 1 ? t("lbGuessSingular") : t("lbGuessPlural")}</span>
            </span>
        </div>
    `;

}

async function loadLeaderboardList(overlay) {

    const list = overlay.querySelector("#leaderboardList");
    const myNickname = getNickname();

    list.innerHTML = `<div class="leaderboard-empty">${t("lbLoading")}</div>`;

    try {

        const rawEntries = await fetchLeaderboardEntries(leaderboardScope);

        if (rawEntries.length === 0) {

            const emptyMsg =
                leaderboardScope === "weekly"
                    ? t("lbEmptyWeekly")
                    : t("lbEmptyAll");

            list.innerHTML = `<div class="leaderboard-empty">${emptyMsg}</div>`;

            return;

        }

        // One row per player (their personal best run), ranked by fewest
        // guesses, then fastest time as a tiebreaker — see fetch's `order`.
        const ranked = dedupeLeaderboardEntries(rawEntries);

        const top = ranked.slice(0, 10);

        let html = top
            .map((entry, i) => renderLeaderboardRow(entry, i + 1, myNickname))
            .join("");

        // If the player has a nickname and a best run, but it didn't make
        // the top 10 shown above, pin their own rank below the list so
        // they can still see how they're doing.
        if (myNickname) {

            const myIndex = ranked.findIndex(
                entry => entry.nickname.trim().toLowerCase() === myNickname.trim().toLowerCase()
            );

            if (myIndex >= 10) {

                html += `
                    <div class="leaderboard-divider"><span>${t("lbYourRank")}</span></div>
                    ${renderLeaderboardRow(ranked[myIndex], myIndex + 1, myNickname)}
                `;

            } else if (myIndex === -1 && rawEntries.length >= LB_FETCH_LIMIT) {

                // We hit the fetch cap without finding this player — their
                // best run exists, just further down than we can measure.
                html += `<div class="leaderboard-divider"><span>${t("lbRankBeyond")}</span></div>`;

            }

        }

        list.innerHTML = html;

    } catch (e) {

        list.innerHTML = `<div class="leaderboard-empty">${t("lbErrorLoad")}</div>`;

    }

}


const leaderboardStyle = document.createElement("style");

leaderboardStyle.textContent = `
    .leaderboard-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        z-index: 400;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }

    .leaderboard-overlay.show {
        display: flex;
    }

    .leaderboard-card {
        position: relative;
        background: rgba(16, 23, 34, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 32px 24px 24px;
        max-width: 400px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .leaderboard-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.08);
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: 0.2s ease;
    }

    .leaderboard-close:hover {
        background: rgba(255, 255, 255, 0.18);
    }

    .leaderboard-title {
        font-size: 20px;
        font-weight: 700;
        color: white;
        margin-bottom: 4px;
    }

    .leaderboard-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 18px;
    }

    .leaderboard-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .leaderboard-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 16px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 10px;
        padding: 4px;
    }

    .leaderboard-tab {
        flex: 1;
        padding: 8px 10px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        transition: 0.2s ease;
    }

    .leaderboard-tab:hover {
        color: rgba(255, 255, 255, 0.9);
    }

    .leaderboard-tab.active {
        background: #3d8bfd;
        color: white;
    }

    .leaderboard-empty {
        color: rgba(255, 255, 255, 0.5);
        font-size: 14px;
        padding: 20px 0;
    }

    .leaderboard-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        text-align: left;
    }

    .leaderboard-row.me {
        border-color: rgba(61, 139, 253, 0.6);
        background: rgba(61, 139, 253, 0.12);
    }

    .leaderboard-row.rank-1 {
        border-color: rgba(255, 215, 0, 0.5);
        background: rgba(255, 215, 0, 0.08);
        box-shadow: 0 0 16px rgba(255, 215, 0, 0.15);
    }

    .leaderboard-row.rank-2 {
        border-color: rgba(200, 210, 220, 0.5);
        background: rgba(200, 210, 220, 0.07);
        box-shadow: 0 0 14px rgba(200, 210, 220, 0.12);
    }

    .leaderboard-row.rank-3 {
        border-color: rgba(205, 127, 50, 0.5);
        background: rgba(205, 127, 50, 0.08);
        box-shadow: 0 0 14px rgba(205, 127, 50, 0.12);
    }

    .leaderboard-row.rank-1.me,
    .leaderboard-row.rank-2.me,
    .leaderboard-row.rank-3.me {
        border-color: rgba(61, 139, 253, 0.7);
    }

    .leaderboard-rank {
        width: 24px;
        font-weight: 700;
        font-size: 15px;
        color: rgba(255, 255, 255, 0.6);
        flex-shrink: 0;
        text-align: center;
    }

    .leaderboard-name {
        flex: 1;
        font-weight: 700;
        color: white;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .leaderboard-you {
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: #3d8bfd;
    }

    .leaderboard-difficulty {
        font-size: 11px;
        text-transform: capitalize;
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
    }

    .leaderboard-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .leaderboard-wins {
        font-size: 11px;
        font-weight: 700;
        color: rgba(255, 215, 0, 0.85);
        flex-shrink: 0;
    }

    .leaderboard-attempts {
        font-size: 12px;
        font-weight: 700;
        color: #3d8bfd;
        flex-shrink: 0;
    }

    .leaderboard-divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0 2px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: rgba(255, 255, 255, 0.4);
        text-align: center;
        justify-content: center;
    }

    .leaderboard-divider::before,
    .leaderboard-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: rgba(255, 255, 255, 0.12);
    }

    @media (max-width: 500px) {

        .leaderboard-card {
            padding: 26px 18px 18px;
        }

    }
`;

document.head.appendChild(leaderboardStyle);


// ------------------------------------------
// START LEADERBOARD SYSTEM
// ------------------------------------------

injectLeaderboardMenuButton();

// ------------------------------------------
// TOP BAR — group settings + language + nickname
// ------------------------------------------

const topBarStyle = document.createElement("style");

topBarStyle.textContent = `
    #topBar {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* children are laid out by the flex row, not by their own coords */
    #topBar .sound-toggle,
    #topBar .nickname-badge {
        position: static;
        top: auto;
        right: auto;
        left: auto;
        flex-shrink: 0;
    }

    /* selector stays relative so its dropdown anchors to it */
    #topBar .language-selector {
        position: relative;
        top: auto;
        right: auto;
        left: auto;
        flex-shrink: 0;
    }

    /* dropdown opens toward the left so it can't spill off-screen */
    #topBar .language-menu {
        left: auto;
        right: 0;
    }

    html[dir="rtl"] #topBar {
        right: auto;
        left: 18px;
    }

    html[dir="rtl"] #topBar .language-menu {
        right: auto;
        left: 0;
    }

    @media (max-width: 500px) {

        #topBar {
            top: 12px;
            right: 12px;
            gap: 8px;
        }

        html[dir="rtl"] #topBar {
            right: auto;
            left: 12px;
        }

    }
`;

document.head.appendChild(topBarStyle);


function mountTopBar() {

    if (document.getElementById("topBar")) return;

    const settings = document.getElementById("settingsToggle");
    const language = document.getElementById("languageSelector");
    const nickname = document.getElementById("nicknameBadge");

    if (!settings && !language && !nickname) return;

    const bar = document.createElement("div");

    bar.id = "topBar";

    // order left-to-right: ⚙️  🌐 EN  👤 Nickname
    [settings, language, nickname].forEach(el => {
        if (el) bar.appendChild(el);
    });

    document.body.appendChild(bar);

}

mountTopBar();


// ------------------------------------------
// NICKNAME PROMPT STRINGS
// ------------------------------------------

const NICKNAME_STRINGS = {

    en: {
        nickTitle: "👋 What should we call you?",
        nickSubtitle: "Your nickname is saved on this device and shown on the leaderboard.",
        nickPlaceholder: "Enter a nickname",
        nickSubmit: "Let's play",
        nickTaken: "This nickname is already picked by another player."
    },

    fr: {
        nickTitle: "👋 Comment doit-on t'appeler ?",
        nickSubtitle: "Ton pseudo est enregistré sur cet appareil et affiché dans le classement.",
        nickPlaceholder: "Entre un pseudo",
        nickSubmit: "C'est parti",
        nickTaken: "Ce pseudo est déjà pris par un autre joueur."
    },

    ar: {
        nickTitle: "👋 ماذا نناديك؟",
        nickSubtitle: "يُحفظ اسمك المستعار على هذا الجهاز ويظهر في لوحة المتصدرين.",
        nickPlaceholder: "أدخل اسماً مستعاراً",
        nickSubmit: "هيا نلعب",
        nickTaken: "هذا الاسم المستعار مستخدم من قبل لاعب آخر."
    },

    es: {
        nickTitle: "👋 ¿Cómo te llamamos?",
        nickSubtitle: "Tu apodo se guarda en este dispositivo y aparece en la clasificación.",
        nickPlaceholder: "Escribe un apodo",
        nickSubmit: "A jugar",
        nickTaken: "Este apodo ya está elegido por otro jugador."
    },

    it: {
        nickTitle: "👋 Come ti chiamiamo?",
        nickSubtitle: "Il tuo nickname è salvato su questo dispositivo e appare in classifica.",
        nickPlaceholder: "Inserisci un nickname",
        nickSubmit: "Giochiamo",
        nickTaken: "Questo nickname è già scelto da un altro giocatore."
    },

    ja: {
        nickTitle: "👋 なんてお呼びしましょう？",
        nickSubtitle: "ニックネームはこの端末に保存され、リーダーボードに表示されます。",
        nickPlaceholder: "ニックネームを入力",
        nickSubmit: "プレイする",
        nickTaken: "このニックネームは他のプレイヤーが既に使用しています。"
    }

};

Object.keys(NICKNAME_STRINGS).forEach(code => {

    if (FOOTDLE_LANGUAGES[code]) {
        Object.assign(FOOTDLE_LANGUAGES[code], NICKNAME_STRINGS[code]);
    }

});

// ------------------------------------------
// VANITAS BIO STRINGS
// ------------------------------------------

const VANITAS_BIO_STRINGS = {

    en: {
        vanitasBioTitle: "⚽ WHO IS VANITAS?",
        vanitasBioP1: "Vanitas — real name Khalil — is a small solo dev from Morocco, exactly from Marrakech.",
        vanitasBioP2: "He built this mini game simply because he's a big fan of football and wanted to make something fun for other fans to play and share.",
        vanitasSocial: "🔗 Social Links"
    },

    fr: {
        vanitasBioTitle: "⚽ QUI EST VANITAS ?",
        vanitasBioP1: "Vanitas — de son vrai nom Khalil — est un petit développeur solo du Maroc, précisément de Marrakech.",
        vanitasBioP2: "Il a créé ce mini-jeu simplement parce qu'il est un grand fan de football et voulait faire quelque chose d'amusant que les autres fans pourraient jouer et partager.",
        vanitasSocial: "🔗 Réseaux sociaux"
    },

    ar: {
        vanitasBioTitle: "⚽ من هو Vanitas؟",
        vanitasBioP1: "Vanitas — واسمه الحقيقي خليل — مطور فردي صغير من المغرب، وتحديداً من مراكش.",
        vanitasBioP2: "أنشأ هذه اللعبة المصغرة ببساطة لأنه من عشاق كرة القدم الكبار وأراد صنع شيء ممتع ليعبث به المشجعون الآخرون ويشاركوه.",
        vanitasSocial: "🔗 روابط التواصل"
    },

    es: {
        vanitasBioTitle: "⚽ ¿QUIÉN ES VANITAS?",
        vanitasBioP1: "Vanitas — cuyo nombre real es Khalil — es un pequeño desarrollador en solitario de Marruecos, concretamente de Marrakech.",
        vanitasBioP2: "Creó este mini juego simplemente porque es un gran fanático del fútbol y quería hacer algo divertido para que otros aficionados jugaran y compartieran.",
        vanitasSocial: "🔗 Redes sociales"
    },

    it: {
        vanitasBioTitle: "⚽ CHI È VANITAS?",
        vanitasBioP1: "Vanitas — vero nome Khalil — è un piccolo sviluppatore solitario del Marocco, precisamente da Marrakech.",
        vanitasBioP2: "Ha creato questo mini gioco semplicemente perché è un grande fan del calcio e voleva fare qualcosa di divertente che altri tifosi potessero giocare e condividere.",
        vanitasSocial: "🔗 Social"
    },

    ja: {
        vanitasBioTitle: "⚽ Vanitasとは？",
        vanitasBioP1: "Vanitas — 本名カリル — はモロッコ、マラケシュ出身の小さなソロ開発者です。",
        vanitasBioP2: "サッカーの大ファンであり、他のファンが遊んで共有できる楽しいものを作りたかったという理由だけで、このミニゲームを作りました。",
        vanitasSocial: "🔗 SNS"
    }

};

Object.keys(VANITAS_BIO_STRINGS).forEach(code => {

    if (FOOTDLE_LANGUAGES[code]) {
        Object.assign(FOOTDLE_LANGUAGES[code], VANITAS_BIO_STRINGS[code]);
    }

});

// ------------------------------------------
// TOP BAR — hover glow
// ------------------------------------------

const topBarGlowStyle = document.createElement("style");

topBarGlowStyle.textContent = `
    .sound-toggle:hover {
        border-color: rgba(61,139,253,0.55);
        box-shadow: 0 0 0 1px rgba(61,139,253,0.25), 0 0 18px rgba(61,139,253,0.55);
    }
`;

document.head.appendChild(topBarGlowStyle);


// ------------------------------------------
// MODAL CLOSE BUTTON — position fix
// A later rule in style.css (the shared hover/press
// "ripple" block) sets .modal-close to position:relative,
// which overrides its original position:absolute and drops
// it into normal flow, landing on top of the modal's icon.
// Restore it to the pinned corner.
// ------------------------------------------

const modalCloseFixStyle = document.createElement("style");

modalCloseFixStyle.textContent = `
    .modal-close {
        position: absolute;
        top: 14px;
        right: 14px;
    }

    html[dir="rtl"] .modal-close {
        right: auto;
        left: 14px;
    }
`;

document.head.appendChild(modalCloseFixStyle);


// ------------------------------------------
// SETTINGS MODAL — drop volume sliders,
// add an "ABOUT THIS GAME" section
// ------------------------------------------

const aboutSectionStyle = document.createElement("style");

aboutSectionStyle.textContent = `
    .about-feedback-link {
        width: 100%;
        margin: 12px 0 0;
        text-align: center;
        text-decoration: none;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(135deg, rgba(212, 154, 24, 0.20), rgba(16, 23, 34, 0.88));
        border: 1px solid rgb(212, 154, 24);
        box-shadow: 0 0 16px rgba(212, 154, 24, 0.4), inset 0 0 0 1px rgba(212, 154, 24, 0.12);
        color: white;
    }

    .about-feedback-link:hover {
        border-color: rgb(234, 178, 52);
        box-shadow: 0 0 24px rgba(212, 154, 24, 0.6), inset 0 0 0 1px rgba(212, 154, 24, 0.2);
        transform: translateY(-2px);
    }

    .vanitas-donate-link {
        width: 100%;
        margin: 10px 0 0;
        text-align: center;
        text-decoration: none;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(135deg, rgba(255, 94, 91, 0.22), rgba(16, 23, 34, 0.88));
        border: 1px solid rgb(255, 94, 91);
        box-shadow: 0 0 16px rgba(255, 94, 91, 0.4), inset 0 0 0 1px rgba(255, 94, 91, 0.12);
        color: white;
    }

    .vanitas-donate-link:hover {
        border-color: rgb(255, 130, 127);
        box-shadow: 0 0 24px rgba(255, 94, 91, 0.6), inset 0 0 0 1px rgba(255, 94, 91, 0.2);
        transform: translateY(-2px);
    }
`;

document.head.appendChild(aboutSectionStyle);


function customizeSettingsModal() {

    const settingsBox = document.querySelector(".settings-box");

    if (!settingsBox || document.getElementById("aboutGameSection")) return;

    // "instead of putting volume settings" — drop the volume
    // sliders, keep the on/off toggles above them
    document.querySelectorAll(".settings-slider").forEach(slider => slider.remove());

    // Find the existing "OTHER" section so the new one lands
    // right after it, before the danger zone
    let otherSection = null;

    settingsBox.querySelectorAll(".settings-section-title").forEach(titleEl => {
        if (titleEl.textContent.trim().toUpperCase() === "OTHER") {
            otherSection = titleEl.closest(".settings-section");
        }
    });

    const aboutSection = document.createElement("div");

    aboutSection.id = "aboutGameSection";
    aboutSection.className = "settings-section";

        aboutSection.innerHTML = `
        <h3 class="settings-section-title">ABOUT THIS GAME</h3>

        <div class="settings-group" data-accent="yellow">

            <div class="settings-row">
                <div class="settings-row-label">
                    <span class="settings-row-icon">👤</span>
                    <span id="madeByLabel">${t("settingsMadeBy")}</span>
                </div>
            </div>

            <button type="button"
                    id="vanitasBioButton"
                    class="secondary-button about-feedback-link">
                ${t("settingsWhoIsVanitas")}
            </button>

            <a href="https://ko-fi.com/ceciyuu"
               target="_blank"
               rel="noopener noreferrer"
               id="vanitasKofiLink"
               class="secondary-button vanitas-donate-link">
                ${t("settingsSupportKofi")}
            </a>

        </div>
    `;

    const bioButton = aboutSection.querySelector("#vanitasBioButton");

    if (bioButton) {
        bioButton.addEventListener("click", openVanitasBioModal);
    }

    if (otherSection) {
        otherSection.insertAdjacentElement("afterend", aboutSection);
    } else {

        const dangerSection = settingsBox.querySelector(".settings-danger");

        if (dangerSection) {
            dangerSection.insertAdjacentElement("beforebegin", aboutSection);
        } else {
            settingsBox.appendChild(aboutSection);
        }

    }

}

customizeSettingsModal();


// ------------------------------------------
// SETTINGS MODAL — collapse SOUND into a
// "🔊 Sounds" button you click to reveal
// ------------------------------------------

const soundCollapsibleStyle = document.createElement("style");

soundCollapsibleStyle.textContent = `
    .settings-collapsible-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        box-sizing: border-box;
        padding: 16px;
        margin: 0 0 14px;
        border-radius: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 16px;
        font-weight: bold;
        letter-spacing: 0.5px;
        color: white;
        background: linear-gradient(135deg, rgba(61, 139, 253, 0.20), rgba(16, 23, 34, 0.88));
        border: 1px solid rgb(61, 139, 253);
        box-shadow: 0 0 16px rgba(61, 139, 253, 0.4), inset 0 0 0 1px rgba(61, 139, 253, 0.12);
        transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    }

    .settings-collapsible-toggle:hover,
    .settings-collapsible-toggle.open {
        border-color: rgb(96, 165, 255);
        box-shadow: 0 0 24px rgba(61, 139, 253, 0.6), inset 0 0 0 1px rgba(61, 139, 253, 0.2);
        transform: translateY(-2px);
    }

    .settings-collapsible-chevron {
        font-size: 14px;
        transition: transform 0.2s ease;
    }

    .settings-collapsible-toggle.open .settings-collapsible-chevron {
        transform: rotate(180deg);
    }

    .settings-collapsible-content {
        overflow: hidden;
        max-height: 0;
        transition: max-height 0.3s ease;
    }
`;

document.head.appendChild(soundCollapsibleStyle);


function collapseSoundSection() {

    const settingsBox = document.querySelector(".settings-box");

    if (!settingsBox || document.getElementById("soundToggleButton")) return;

    let soundTitle = null;

    settingsBox.querySelectorAll(".settings-section-title").forEach(titleEl => {
        if (titleEl.textContent.trim().toUpperCase() === "SOUND") {
            soundTitle = titleEl;
        }
    });

    if (!soundTitle) return;

    const soundSection = soundTitle.closest(".settings-section");
    const groups = Array.from(soundSection.querySelectorAll(":scope > .settings-group"));

    // Wrap the Music / Sound Effects rows so they can be
    // shown/hidden together
    const contentWrapper = document.createElement("div");

    contentWrapper.id = "soundCollapsibleContent";
    contentWrapper.className = "settings-collapsible-content";

    groups.forEach(group => contentWrapper.appendChild(group));

    // Replace the plain "SOUND" title with a clickable button
    const toggleButton = document.createElement("button");

    toggleButton.type = "button";
    toggleButton.id = "soundToggleButton";
    toggleButton.className = "settings-collapsible-toggle";
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.setAttribute("aria-controls", "soundCollapsibleContent");

    toggleButton.dataset.i18n = "sound";
    toggleButton.innerHTML = `
        <span>🔊 Sounds</span>
        <span class="settings-collapsible-chevron">▾</span>
    `;

    soundTitle.replaceWith(toggleButton);
    toggleButton.insertAdjacentElement("afterend", contentWrapper);

    toggleButton.addEventListener("click", () => {

        const isOpen = toggleButton.classList.toggle("open");

        toggleButton.setAttribute("aria-expanded", String(isOpen));

        contentWrapper.style.maxHeight =
            isOpen ? contentWrapper.scrollHeight + "px" : "0px";

    });

}

collapseSoundSection();


// ------------------------------------------
// "WHO IS VANITAS?" BIO MODAL
// ------------------------------------------

const vanitasBioStyle = document.createElement("style");

vanitasBioStyle.textContent = `
    .vanitas-bio-text {
        color: #c3cede;
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 12px;
    }

    .vanitas-bio-text:last-of-type {
        margin-bottom: 22px;
    }

    .vanitas-social-link {
        width: 100%;
        margin: 0;
        text-align: center;
        text-decoration: none;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
`;

document.head.appendChild(vanitasBioStyle);


function buildVanitasBioModal() {

    if (document.getElementById("vanitasBioModal")) return;

    const overlay = document.createElement("div");

    overlay.id = "vanitasBioModal";
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", closeVanitasBioModal);

        overlay.innerHTML = `
        <div class="modal-box">

            <button class="modal-close" aria-label="Close">✕</button>

            <h2 id="vanitasBioTitle">${t("vanitasBioTitle")}</h2>

            <p class="vanitas-bio-text" id="vanitasBioP1">
                ${t("vanitasBioP1")}
            </p>

            <p class="vanitas-bio-text" id="vanitasBioP2">
                ${t("vanitasBioP2")}
            </p>

            <a href="https://guns.lol/itzvanitas1"
               target="_blank"
               rel="noopener noreferrer"
               id="vanitasSocialLink"
               class="secondary-button about-feedback-link vanitas-social-link">
                ${t("vanitasSocial")}
            </a>

        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".modal-close");

    if (closeBtn) {
        closeBtn.addEventListener("click", closeVanitasBioModal);
    }

}

function applyVanitasBioLanguage() {

    const modal = document.getElementById("vanitasBioModal");
    if (!modal) return;

    const title = modal.querySelector("#vanitasBioTitle");
    const p1 = modal.querySelector("#vanitasBioP1");
    const p2 = modal.querySelector("#vanitasBioP2");
    const social = modal.querySelector("#vanitasSocialLink");

    if (title) title.textContent = t("vanitasBioTitle");
    if (p1) p1.textContent = t("vanitasBioP1");
    if (p2) p2.textContent = t("vanitasBioP2");
    if (social) social.textContent = t("vanitasSocial");

}

function openVanitasBioModal() {

    buildVanitasBioModal();

    function applyVanitasBioLanguage() {

    const modal = document.getElementById("vanitasBioModal");
    if (!modal) return;

    const title = modal.querySelector("#vanitasBioTitle");
    const p1 = modal.querySelector("#vanitasBioP1");
    const p2 = modal.querySelector("#vanitasBioP2");
    const social = modal.querySelector("#vanitasSocialLink");

    if (title) title.textContent = t("vanitasBioTitle");
    if (p1) p1.textContent = t("vanitasBioP1");
    if (p2) p2.textContent = t("vanitasBioP2");
    if (social) social.textContent = t("vanitasSocial");

}

    const modal = document.getElementById("vanitasBioModal");

    if (!modal) return;

    modal.style.display = "block";

    modal.classList.add("open");

}

function closeVanitasBioModal(event) {

    const modal = document.getElementById("vanitasBioModal");

    if (!modal) return;

    if (
        !event ||
        event.target === modal ||
        event.target.classList.contains("modal-close")
    ) {
        modal.classList.remove("open");
        modal.style.display = "none";
    }

}