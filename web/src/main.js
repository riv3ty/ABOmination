// Einstieg: Styles laden, dann Anmeldung zeigen. Die App selbst startet erst nach dem Entsperren (auth.js → startApp).
import "./styles.css";
import { startAuth } from "./auth.js";

// Auf der Rücksprung-Seite der Microsoft-Anmeldung (Popup, siehe Skript im <head>) nichts starten
if (!window.__aboCb) startAuth();
