// Arduino sketch (UNO / Nano / Mega)
const int RELAY_PIN = 3;
String line = "";

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // relais OFF (ajuste si relais inverse)
  Serial.begin(115200);
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\\n' || c == '\\r') {
      if (line.length() > 0) {
        processLine(line);
        line = "";
      }
    } else {
      line += c;
    }
  }
}

void processLine(String l) {
  l.trim();
  // Attendu : "OPEN:123"
  if (l.startsWith("OPEN:")) {
    // extraire id si besoin
    String id = l.substring(5);
    Serial.print("Activate relay for id=");
    Serial.println(id);
    digitalWrite(RELAY_PIN, HIGH); // active
    delay(2000); // maintien 2s (ajuster)
    digitalWrite(RELAY_PIN, LOW);  // désactive
  } else if (l == "PING") {
    Serial.println("PONG");
  }
}
