const int RELAY_PIN = 3;

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.begin(9600);
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '1') {
      digitalWrite(RELAY_PIN, HIGH); // relais ON
    } else if (c == '0') {
      digitalWrite(RELAY_PIN, LOW);  // relais OFF
    }
  }
}
