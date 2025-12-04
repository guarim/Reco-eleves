// -------------------- CONFIG --------------------
const MODEL_URL = './models';              // dossier face-api.js [web:4]
const CSV_PATH  = './eleves.csv';          // dans le même repo GitHub [web:8]
const MATCH_THRESHOLD = 0.6;               // seuil de similarité face-api [web:1]

// Dictionnaire : id -> données CSV
let studentsById = {};
// id -> LabeledFaceDescriptor
let labeledDescriptors = [];
let faceMatcher = null;

// Web Serial
let arduinoPort = null;
let arduinoWriter = null;

// -------------------- INIT --------------------
window.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  await loadCSV();
  await loadReferenceFaces();
  initVideo();
  initArduinoButton();
});

// -------------------- Models / CSV --------------------
async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
}

async function loadCSV() {
  return new Promise((resolve, reject) => {
    Papa.parse(CSV_PATH, {
      download: true,
      header: false,
      dynamicTyping: false,
      complete: (results) => {
        // on suppose: col0 = id, col1 = nom, col2 = prénom, col3 = classe, col4 = email
        results.data.forEach(row => {
          if (!row || row.length < 2) return;
          const id = String(row[0]).trim();
          studentsById[id] = {
            id,
            name: row[1] || '',
            firstname: row[2] || '',
            classe: row[3] || '',
            email: row[4] || ''
          };
        });
        resolve();
      },
      error: (err) => reject(err)
    });
  });
}

// Pré-calcul des descripteurs à partir des images assets/1.png, 2.png, ...
async function loadReferenceFaces() {
  const ids = Object.keys(studentsById);
  const descriptors = [];

  for (const id of ids) {
    const imgPath = `./assets/${id}.png`;
    try {
      const img = await faceapi.fetchImage(imgPath);
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) continue;

      descriptors.push(
        new faceapi.LabeledFaceDescriptors(id, [detection.descriptor])
      );
    } catch (e) {
      // image manquante ou non détectable -> ignorée
    }
  }

  labeledDescriptors = descriptors;
  faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
}

// -------------------- Webcam & Reconnaissance --------------------
function initVideo() {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const ctx = overlay.getContext('2d');

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.addEventListener('playing', () => {
        const { width, height } = video.getBoundingClientRect();
        overlay.width = 640;
        overlay.height = 480;
        startDetectionLoop(video, overlay, ctx);
      });
    })
    .catch(console.error);
}

function startDetectionLoop(video, canvas, ctx) {
  const displaySize = { width: canvas.width, height: canvas.height };
  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const resized = faceapi.resizeResults(detections, displaySize);
    faceapi.draw.drawDetections(canvas, resized);

    if (!detections.length || !faceMatcher) {
      setDenied();
      return;
    }

    const results = resized.map(d =>
      faceMatcher.findBestMatch(d.descriptor)
    );

    let bestMatch = null;
    let bestDistance = 1;

    results.forEach((res, i) => {
      const box = resized[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, { label: res.toString() });
      drawBox.draw(canvas);

      if (res.distance < bestDistance) {
        bestDistance = res.distance;
        bestMatch = res;
      }
    });

    if (bestMatch && bestMatch.label !== 'unknown') {
      const id = bestMatch.label;
      const student = studentsById[id];
      if (student) {
        setAuthorized(student);
        await sendArduinoCommand('1'); // activer relais
      } else {
        setDenied();
        await sendArduinoCommand('0'); // désactiver relais
      }
    } else {
      setDenied();
      await sendArduinoCommand('0');
    }
  }, 700); // ~1.5 fois / seconde
}

// -------------------- UI --------------------
function setAuthorized(student) {
  document.getElementById('s-id').textContent = student.id;
  document.getElementById('s-name').textContent = student.name;
  document.getElementById('s-firstname').textContent = student.firstname;
  document.getElementById('s-class').textContent = student.classe;
  document.getElementById('s-email').textContent = student.email;

  const msg = document.getElementById('message');
  msg.textContent = 'AUTORISÉ';
  msg.className = 'ok';
}

function setDenied() {
  const msg = document.getElementById('message');
  msg.textContent = "VOUS N'AVEZ PAS L'HABILITATION SUFFISANTE";
  msg.className = 'ko';

  document.getElementById('s-id').textContent = '–';
  document.getElementById('s-name').textContent = '–';
  document.getElementById('s-firstname').textContent = '–';
  document.getElementById('s-class').textContent = '–';
  document.getElementById('s-email').textContent = '–';
}

// -------------------- Arduino (Web Serial) --------------------
function initArduinoButton() {
  const btn = document.getElementById('connect-arduino');
  btn.addEventListener('click', async () => {
    try {
      arduinoPort = await navigator.serial.requestPort();
      await arduinoPort.open({ baudRate: 9600 });
      arduinoWriter = arduinoPort.writable.getWriter();
      btn.textContent = 'Arduino connecté';
      btn.disabled = true;
    } catch (e) {
      console.error(e);
    }
  });
}

// Envoi '1' ou '0' à l’Arduino pour piloter la broche 3 (voir code Arduino)
async function sendArduinoCommand(value) {
  if (!arduinoWriter) return;
  const data = new TextEncoder().encode(value + '\n');
  try {
    await arduinoWriter.write(data);
  } catch (e) {
    console.error(e);
  }
}
