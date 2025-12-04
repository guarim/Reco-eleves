void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT); // Pin du relais
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    if (cmd == "ON") {
      digitalWrite(13, HIGH);
    } else if (cmd == "OFF") {
      digitalWrite(13, LOW);
    }
  }
}
