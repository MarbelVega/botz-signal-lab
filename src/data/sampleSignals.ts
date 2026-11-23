/** Lista de ejemplo (formato libre). Todas las horas están en UTC-3 (America/Sao_Paulo). */
export const SAMPLE_REAL = `# Lista de ejemplo · mercado REAL · hora UTC-3
M5;EUR/AUD;09:05;CALL
M5;GBP/CHF;09:35;PUT
M1;EUR/USD;10:12;CALL
M5;EUR/GBP;10:40;PUT
M1;AUD/CAD;11:03;PUT
M5;GBP/USD;11:30;CALL
M1;USD/JPY;12:17;PUT
M5;EUR/AUD;13:05;PUT`;

export const SAMPLE_OTC = `# Lista de ejemplo · mercado OTC · hora UTC-3
09:10 - EUR/GBP OTC - CALL - M1
09:42 - EUR/USD OTC - PUT - M5
EURJPY-OTC 10:15 CALL M1
GBPUSD-OTC 10:50 PUT M5
11:22 AUD/CAD OTC CALL M1`;
