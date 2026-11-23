// @openav/hw · parts — the electronics a work can be built from. Plain data, no code.
//
// Every number comes from the maker's datasheet or product page listed in `sources` (read 2026-11-23). A value nobody could
// confirm is null and named in `tbd` (shown as 待查): the checks then say "cannot tell" instead of passing it.
// Where two revisions of a datasheet disagree, the stricter value is used and `notes` says so.
//
// Part = {
//   name, zh, kind: 'board' | 'sensor' | 'light' | 'power' | 'input' | 'module',
//   sources: [{ title, url }],
//   supply: { min, max, nominal } (V, what its power pin accepts) | null,
//   logic:  { v (V, its logic high), vohMin (V, guaranteed high), vih (input high threshold: { frac } of VDD, or { v, atVdd },
//             a list = several datasheet revisions, the strictest wins), vinMax (V, or { aboveVdd }), fiveVoltSafe },
//   current: { typ, max } (mA, the whole part) | perLed: { typ, max } (mA per LED, × leds) | resistance (Ω, a divider),
//   pins: { NAME: { kind, label, gpio, v, when, limitMa, recMa, from, vmax, aliases, boot, note } },
//   i2c: { addr: [...], default, select },
//   size: { w, h, d } mm (null = 待查), connector, notes: [], tbd: [], bomNote
// }
// Pin kinds: gnd · power-out (a source: `v` volts, `when` it is only there sometimes, `from` the pins a regulator is fed by,
// `limitMa`/`recMa`) · power-in (where the part takes its supply) · bat (a cell's terminal) · power-node (a rail the board
// passes through, e.g. BAT) · io · i2c-sda · i2c-scl · spi-sck · spi-mosi · spi-miso · spi-cs · data-in · data-out ·
// analog-in (`vmax`) · analog-out · reset.

const S = {
  featherPinouts: { title: 'Adafruit: Feather HUZZAH ESP8266, Pinouts', url: 'https://learn.adafruit.com/adafruit-feather-huzzah-esp8266/pinouts' },
  featherPower: { title: 'Adafruit: Feather HUZZAH ESP8266, Power Management', url: 'https://learn.adafruit.com/adafruit-feather-huzzah-esp8266/power-management' },
  feather2821: { title: 'Adafruit product 2821 (Feather HUZZAH with ESP8266)', url: 'https://www.adafruit.com/product/2821' },
  featherPcb: { title: 'Adafruit Feather HUZZAH ESP8266 PCB files (schematics, rev E and G)', url: 'https://github.com/adafruit/Adafruit-Feather-ESP8266-HUZZAH-PCB' },
  esp8266: { title: 'Espressif ESP8266EX Datasheet v7.1 (Table 5-1, Table 5-3)', url: 'https://documentation.espressif.com/0a-esp8266ex_datasheet_en.pdf' },
  espFaq: { title: 'Espressif ESP-FAQ: hardware design', url: 'https://docs.espressif.com/projects/esp-faq/en/latest/hardware-related/hardware-design.html' },
  espBoot: { title: 'Espressif esptool: ESP8266 boot mode selection', url: 'https://docs.espressif.com/projects/esptool/en/latest/esp8266/advanced-topics/boot-mode-selection.html' },
  mcp73831: { title: 'Microchip MCP73831/2 datasheet DS20001984H', url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/MCP73831-Family-Data-Sheet-DS20001984H.pdf' },
  leoSpecs: { title: 'Arduino Leonardo tech specs (docs-content)', url: 'https://github.com/arduino/docs-content/blob/main/content/hardware/hero/boards/leonardo/tech-specs.yml' },
  leoPinout: { title: 'Arduino Leonardo full pinout A000057', url: 'https://docs.arduino.cc/resources/pinouts/A000057-full-pinout.pdf' },
  atmega32u4: { title: 'Microchip ATmega16U4/32U4 datasheet (29.1, Table 29-1)', url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7766-8-bit-AVR-ATmega16U4-32U4_Datasheet.pdf' },
  unoDatasheet: { title: 'Arduino UNO R3 datasheet A000066', url: 'https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf' },
  unoPinout: { title: 'Arduino UNO R3 full pinout A000066', url: 'https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf' },
  unoSpecs: { title: 'Arduino UNO R3 tech specs (docs-content)', url: 'https://github.com/arduino/docs-content/blob/main/content/hardware/uno/boards/uno-rev3/tech-specs.yml' },
  atmega328p: { title: 'Microchip ATmega328P automotive datasheet 7810D (28.2)', url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf' },
  mfrc522: { title: 'NXP MFRC522 datasheet (Table 150, 153)', url: 'https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf' },
  joyRc522: { title: 'Joy-IT SBC-RFID-RC522 manual (2024-04-23)', url: 'https://www.joy-it.net/files/files/Produkte/SBC-RFID-RC522/SBC-RFID-RC522_Manual_2024-04-23.pdf' },
  hcsr501: { title: 'HC-SR501 datasheet (MPJA 31227sc; vendor sheet, no maker datasheet exists)', url: 'https://courses.ece.cornell.edu/ece5990/ECE5725_Spring2020_Projects/May_15_Demo/Smart%20Lock/W_pp445_yl656/datasheet/31227sc.pdf' },
  adaPir: { title: 'Adafruit: PIR motion sensor', url: 'https://learn.adafruit.com/pir-passive-infrared-proximity-motion-sensor/overview' },
  ada562: { title: 'Adafruit product 562 (10K linear potentiometer)', url: 'https://www.adafruit.com/product/562' },
  ptv09: { title: 'Bourns PTV09 datasheet', url: 'https://www.bourns.com/docs/Product-Datasheets/ptv09.pdf' },
  lis3dh: { title: 'ST LIS3DH datasheet (Table 5, 6, 12; 6.1.1)', url: 'https://www.st.com/resource/en/datasheet/lis3dh.pdf' },
  adaLis3dh: { title: 'Adafruit: LIS3DH breakout, Pinouts', url: 'https://learn.adafruit.com/adafruit-lis3dh-triple-axis-accelerometer-breakout/pinouts' },
  ada2809: { title: 'Adafruit product 2809 (LIS3DH breakout)', url: 'https://www.adafruit.com/product/2809' },
  mpu6050: { title: 'TDK InvenSense MPU-6000/6050 product specification PS-MPU-6000A rev 3.1', url: 'https://cdn.sparkfun.com/datasheets/Components/General%20IC/PS-MPU-6000A.pdf' },
  mpuPlayground: { title: 'Arduino Playground: MPU-6050 (GY-521)', url: 'https://playground.arduino.cc/Main/MPU-6050/' },
  ws2812b2013: { title: 'Worldsemi WS2812B datasheet (2013)', url: 'https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf' },
  ws2812bV5: { title: 'Worldsemi WS2812B datasheet V5', url: 'https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/8880/WS2812B.pdf' },
  neoBest: { title: 'Adafruit NeoPixel Überguide: best practices', url: 'https://learn.adafruit.com/adafruit-neopixel-uberguide/best-practices' },
  neoPower: { title: 'Adafruit NeoPixel Überguide: powering NeoPixels', url: 'https://learn.adafruit.com/adafruit-neopixel-uberguide/powering-neopixels' },
  sk6812rgbw: { title: 'Opsco SK6812RGBW datasheet rev01', url: 'https://cdn-shop.adafruit.com/product-files/2757/p2757_SK6812RGBW_REV01.pdf' },
  sk6812rgb: { title: 'SK6812 (RGB) datasheet', url: 'https://cdn-shop.adafruit.com/product-files/1138/SK6812+LED+datasheet+.pdf' },
  ring12: { title: 'Adafruit product 1643 (NeoPixel Ring 12)', url: 'https://www.adafruit.com/product/1643' },
  ring16: { title: 'Adafruit product 1463 (NeoPixel Ring 16)', url: 'https://www.adafruit.com/product/1463' },
  lipo258: { title: 'Adafruit product 258 (LiPo 3.7 V 1200 mAh)', url: 'https://www.adafruit.com/product/258' },
  lipo1578: { title: 'Adafruit product 1578 (LiPo 3.7 V 500 mAh)', url: 'https://www.adafruit.com/product/1578' },
  lipoVolt: { title: 'Adafruit: Li-ion and LiPoly batteries, voltages', url: 'https://learn.adafruit.com/li-ion-and-lipoly-batteries/voltages' },
  tp4056: { title: 'NanJing Top Power TP4056 datasheet', url: 'https://www.mikrocontroller.net/attachment/273612/TP4056.pdf' },
  tp4056clone: { title: 'TP4056 datasheet (2020, other vendor)', url: 'https://evelta.com/content/datasheets/464-TP4056.pdf' },
  dw01: { title: 'DW01 battery protection datasheet', url: 'https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/7158/5272_DW01.pdf' },
  ada4410: { title: 'Adafruit product 4410 (Micro-Lipo charger, USB-C)', url: 'https://www.adafruit.com/product/4410' },
  ada1901: { title: 'Adafruit product 1901 (Universal Qi wireless receiver)', url: 'https://www.adafruit.com/product/1901' },
};

const GND = { kind: 'gnd', label: 'GND' };
const NEO_SOURCES = [S.neoPower, S.neoBest];
// Worldsemi WS2812B: input high is 0.7 × VDD in the 2013 sheet and 2.7 V (at VDD 5 V) in V5. SK6812: 3.4 V at VDD 5 V.
const VIH_WS2812B = [{ frac: 0.7, rev: 'WS2812B 2013' }, { v: 2.7, atVdd: 5, rev: 'WS2812B V5' }];
const VIH_SK6812 = [{ v: 3.4, atVdd: 5, rev: 'SK6812' }];
const LED_PINS = { VDD: { kind: 'power-in', label: 'VDD', aliases: ['5V', 'VCC', '+'] }, GND: { ...GND, aliases: ['VSS', '-'] }, DIN: { kind: 'data-in', label: 'DIN', aliases: ['DI', 'IN'] }, DOUT: { kind: 'data-out', label: 'DOUT', aliases: ['DO', 'OUT'] } };
const LED_NOTES = [
  '資料線靠近第一顆燈那端串一顆 300–500 Ω 電阻，電源正負之間並一顆 500–1000 µF（6.3 V 以上）電容（Adafruit NeoPixel Überguide）。',
  '用 LiPo 直接以 3.7 V 供電時，3.3 V 的資料訊號可以用；用 5 V 供電、3.3 V 板子推時，要加電平轉換（74AHCT125 或 74HCT245）（Adafruit NeoPixel Überguide）。',
];

export const PARTS = {
  // ------------------------------------------------------------------ boards
  'feather-huzzah-esp8266': {
    name: 'Adafruit Feather HUZZAH with ESP8266 (2821)', zh: 'Feather HUZZAH ESP8266', kind: 'board',
    sources: [S.featherPinouts, S.featherPower, S.feather2821, S.featherPcb, S.esp8266, S.espFaq, S.espBoot, S.mcp73831],
    supply: null,   // fed through USB (5 V) or a LiPo on BAT, regulated to 3V
    logic: { v: 3.3, vohMin: 2.64, vih: [{ frac: 0.75 }], vinMax: 3.6, fiveVoltSafe: false },
    current: { typ: 80, max: 170 },   // ESP8266EX average 80 mA; 802.11b TX 170 mA typical (Table 5-3, a typical value, not a peak spec)
    charger: { part: 'MCP73831', mA: 100 },
    pins: {
      '3V': { kind: 'power-out', label: '3V', v: 3.3, limitMa: 500, recMa: 250, from: ['USB', 'BAT'], note: '穩壓器尖峰 500 mA，建議持續低於 250 mA（Adafruit）' },
      USB: { kind: 'power-out', label: 'USB', v: 5, when: 'usb', note: '插 micro USB 時才有 5 V；也可以從這裡送 5 V 進板子' },
      BAT: { kind: 'power-node', label: 'BAT', note: 'JST-PH 電池座的正極；板上 MCP73831 從 USB 對它充電' },
      EN: { kind: 'io', label: 'EN', note: '3.3 V 穩壓器致能（上拉），接地關掉 3V' },
      RST: { kind: 'reset', label: 'RST' },
      GND,
      A0: { kind: 'analog-in', label: 'A0', vmax: 1.0, aliases: ['ADC'], note: '最大約 1.0 V，板上沒有分壓' },
      TX: { kind: 'io', label: 'TX', gpio: 1, aliases: ['1', 'GPIO1'], boot: 'tx' },
      RX: { kind: 'io', label: 'RX', gpio: 3, aliases: ['3', 'GPIO3'], boot: 'rx' },
      0: { kind: 'io', label: '#0', gpio: 0, aliases: ['GPIO0'], boot: 'gpio0' },
      2: { kind: 'io', label: '#2', gpio: 2, aliases: ['GPIO2'], boot: 'gpio2' },
      4: { kind: 'io', label: '#4 SDA', gpio: 4, aliases: ['GPIO4', 'SDA'], i2c: 'sda' },
      5: { kind: 'io', label: '#5 SCL', gpio: 5, aliases: ['GPIO5', 'SCL'], i2c: 'scl' },
      12: { kind: 'io', label: '#12 MISO', gpio: 12, aliases: ['GPIO12', 'MISO'] },
      13: { kind: 'io', label: '#13 MOSI', gpio: 13, aliases: ['GPIO13', 'MOSI'] },
      14: { kind: 'io', label: '#14 SCK', gpio: 14, aliases: ['GPIO14', 'SCK'] },
      15: { kind: 'io', label: '#15', gpio: 15, aliases: ['GPIO15'], boot: 'gpio15' },
      16: { kind: 'io', label: '#16', gpio: 16, aliases: ['GPIO16'], note: '接到 RST 才能從深度睡眠醒來' },
    },
    boot: {
      gpio0: '開機時被拉低就會進燒錄模式；板上紅色 LED 接在這支腳（低電位亮）。',
      gpio2: '開機時必須是高電位（板上 10K 上拉）。進燒錄模式時 ROM 會把 GPIO2 設成輸出並送出 UART 訊號（esptool 文件），燒錄或重開機那一下接在這裡的東西會收到雜訊；ESP 模組上的藍色 LED 也在這支腳。',
      gpio15: '開機時必須是低電位（板上 4.7K 下拉）；接的東西不能在開機時把它拉高，否則不會執行程式。',
      tx: 'TX 是 USB 序列埠的線，開機時 ROM 會從這裡印出開機訊息（74880 baud）；開機時不能被拉低。',
      rx: 'RX 是 USB 序列埠的線，接了別的東西可能燒錄失敗。',
    },
    i2c: { master: true, sda: '4', scl: '5' },
    size: { w: 51, h: 23, d: 8 }, connector: 'micro USB；JST-PH 2 pin 電池座',
    notes: ['GPIO 全部 3.3 V，不耐 5 V（Espressif FAQ：「ESP8266 is not 5 V tolerant」，GPIO 上限 3.6 V）。'],
    tbd: [
      'Adafruit 說 RX 有電平轉換、可接 5 V，但三版線路圖都只看到 1K 串聯電阻：當成只能 3.3 V。',
      '充電電流：Adafruit 寫 100 mA；rev G 線路圖的設定電阻推算約 213 mA。',
      'GPIO2 藍色 LED 的極性。',
      '整塊板子深度睡眠時的電流（晶片本身 20 µA，穩壓器、CP2104、充電 IC 另計）。',
    ],
  },
  'arduino-leonardo': {
    name: 'Arduino Leonardo (A000057)', zh: 'Arduino Leonardo', kind: 'board',
    sources: [S.leoSpecs, S.leoPinout, S.atmega32u4],
    supply: { min: 7, max: 12, nominal: 5 },   // VIN; the board runs at 5 V
    logic: { v: 5, vohMin: 4.2, vih: [{ v: 1.9, atVdd: 5 }], vinMax: 5.5, fiveVoltSafe: true },
    current: { typ: null, max: null },
    pins: {
      '5V': { kind: 'power-out', label: '5V', v: 5, limitMa: null },
      '3V3': { kind: 'power-out', label: '3V3', v: 3.3, limitMa: 50 },
      VIN: { kind: 'power-in', label: 'VIN' },
      GND,
      ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => [`D${n}`, { kind: 'io', label: `D${n}`, aliases: [String(n)], ...(n === 2 ? { i2c: 'sda', aliases: ['2', 'SDA'] } : n === 3 ? { i2c: 'scl', aliases: ['3', 'SCL'] } : {}) }])),
      ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((n) => [`A${n}`, { kind: 'analog-in', label: `A${n}`, vmax: 5 }])),
    },
    i2c: { master: true, sda: 'D2', scl: 'D3' },
    size: { w: 68.6, h: 53.3, d: null }, connector: 'micro USB；DC 插座',
    notes: ['ATmega32U4 輸入高電位門檻約 1.9 V（5 V 供電時），3.3 V 訊號讀得到。', '每支腳電流：規格表寫 10 mA、腳位圖寫 20 mA，晶片絕對上限 40 mA。'],
    tbd: ['5V 腳可以拉多少電流。', '整塊板子的耗電。', 'VIN 範圍：規格表 7–12 V，腳位圖 6–20 V。'],
  },
  'arduino-uno-r3': {
    name: 'Arduino UNO R3 (A000066)', zh: 'Arduino UNO R3', kind: 'board',
    sources: [S.unoDatasheet, S.unoPinout, S.unoSpecs, S.atmega328p],
    supply: { min: 7, max: 12, nominal: 5 },
    logic: { v: 5, vohMin: 4.2, vih: [{ frac: 0.6 }], vinMax: 5.5, fiveVoltSafe: true },
    current: { typ: null, max: null },
    pins: {
      '5V': { kind: 'power-out', label: '5V', v: 5, limitMa: null },
      '3V3': { kind: 'power-out', label: '3V3', v: 3.3, limitMa: 50 },
      VIN: { kind: 'power-in', label: 'VIN' },
      GND,
      ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) => [`D${n}`, { kind: 'io', label: `D${n}`, aliases: [String(n), ...(n === 11 ? ['MOSI'] : n === 12 ? ['MISO'] : n === 13 ? ['SCK'] : [])] }])),
      ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((n) => [`A${n}`, { kind: 'io', label: `A${n}`, analog: true, vmax: 5, ...(n === 4 ? { i2c: 'sda', aliases: ['SDA'] } : n === 5 ? { i2c: 'scl', aliases: ['SCL'] } : {}) }])),
    },
    i2c: { master: true, sda: 'A4', scl: 'A5' },
    size: { w: 68.6, h: 53.4, d: null }, connector: 'USB-B；DC 插座 2.1×5.5 mm',
    notes: ['ATmega328P 輸入高電位門檻 0.6 × VCC＝3.0 V：3.3 V 訊號在邊緣。', '每支腳 20 mA（板子規格），晶片絕對上限 40 mA。'],
    tbd: ['5V 腳可以拉多少電流。', '整塊板子的耗電。', '3.3 V 穩壓器型號。'],
  },
  // ------------------------------------------------------------------ inputs and sensors
  rc522: {
    name: 'RC522 RFID module (NXP MFRC522)', zh: 'RC522 RFID 讀卡模組', kind: 'module',
    sources: [S.mfrc522, S.joyRc522],
    supply: { min: 2.5, max: 3.6, nominal: 3.3 },
    logic: { v: 3.3, vohMin: null, vih: [{ frac: 0.7 }], vinMax: { aboveVdd: 0.5 }, fiveVoltSafe: false },
    current: { typ: null, max: null },
    pins: {
      '3.3V': { kind: 'power-in', label: '3.3V', aliases: ['VCC', '3V3'] }, GND, RST: { kind: 'data-in', label: 'RST' },
      SDA: { kind: 'spi-cs', label: 'SDA/SS', aliases: ['SS', 'NSS', 'CS'] }, SCK: { kind: 'spi-sck', label: 'SCK' },
      MOSI: { kind: 'spi-mosi', label: 'MOSI' }, MISO: { kind: 'spi-miso', label: 'MISO' }, IRQ: { kind: 'data-out', label: 'IRQ' },
    },
    size: null, connector: '2.54 mm 排針（8 pin）',
    notes: ['只能 3.3 V 供電；輸入腳上限約 VDD + 0.5 V，接 5 V 板子的 SPI 要降壓（Joy-IT 手冊）。', '天線驅動電流：晶片 60 mA typ、100 mA max（3 V）。'],
    tbd: ['模組整體耗電與尺寸（常見寫 40 × 60 mm，未見原廠資料）。', '各家模組腳位順序不同，照板上印字接。'],
  },
  'pir-hc-sr501': {
    name: 'HC-SR501 PIR motion sensor', zh: 'HC-SR501 人體紅外線感測', kind: 'sensor',
    sources: [S.hcsr501, S.adaPir],
    supply: { min: 4.5, max: 20, nominal: 5 },
    logic: { v: 3.3, vohMin: null, vih: null, vinMax: null, fiveVoltSafe: null },
    current: { typ: 0.05, max: null },
    pins: { VCC: { kind: 'power-in', label: 'VCC' }, OUT: { kind: 'data-out', label: 'OUT' }, GND },
    size: { w: 32, h: 24, d: null }, connector: '3 pin 排針',
    notes: ['輸出高電位 3.3 V。通電後約一分鐘在暖機，這段時間會亂觸發 0–3 次。', '延遲 5–300 秒、靈敏度 3–7 m 用板上兩顆旋鈕調；跳線 H＝可重複觸發。'],
    tbd: ['供電下限：同一份規格書寫 4.5 V 也寫 5 V。', '耗電：同一份規格書寫 <50 µA 也寫 65 mA。', '排針的腳位順序。'],
  },
  'pot-10k': {
    name: 'Rotary potentiometer 10 kΩ linear (Adafruit 562)', zh: '旋轉電位器 10 kΩ', kind: 'input',
    sources: [S.ada562, S.ptv09],
    supply: null, logic: null, resistance: 10000,
    pins: { 1: { kind: 'power-in', label: '1', aliases: ['A', 'LOW', 'GND'] }, 2: { kind: 'analog-out', label: '2（中間）', aliases: ['W', 'WIPER'] }, 3: { kind: 'power-in', label: '3', aliases: ['B', 'HIGH', 'VCC'] } },
    size: null, connector: '3 pin，腳距 0.2"',
    notes: ['分壓器：中間腳的電壓不會超過兩端所接的電壓。'],
    tbd: ['額定功率（Bourns PTV09 是 0.05 W，Adafruit 562 沒寫）。'],
  },
  'lis3dh-breakout': {
    name: 'Adafruit LIS3DH triple-axis accelerometer breakout (2809)', zh: 'LIS3DH 三軸加速度計（Adafruit）', kind: 'sensor',
    sources: [S.lis3dh, S.adaLis3dh, S.ada2809],
    supply: { min: 3, max: 5, nominal: 3.3 },
    logic: { v: 3.3, vohMin: null, vih: null, vinMax: 5, fiveVoltSafe: true },
    current: { typ: 0.011, max: 0.185 },   // chip: normal mode 50 Hz 11 µA; 1344 Hz 185 µA (Table 12)
    pins: {
      VIN: { kind: 'power-in', label: 'VIN', aliases: ['VCC'] }, '3Vo': { kind: 'power-out', label: '3Vo', v: 3.3, limitMa: 100, from: ['VIN'] }, GND,
      SCL: { kind: 'i2c-scl', label: 'SCL' }, SDA: { kind: 'i2c-sda', label: 'SDA' }, SDO: { kind: 'data-out', label: 'SDO', note: '接 3.3 V 改位址成 0x19' },
      CS: { kind: 'spi-cs', label: 'CS' }, INT: { kind: 'data-out', label: 'INT' },
    },
    i2c: { addr: ['0x18', '0x19'], default: '0x18', select: 'SDO 空接或接地＝0x18，接 3.3 V＝0x19（Adafruit）' },
    size: { w: 25.4, h: 17.8, d: null }, connector: 'STEMMA QT ×2＋2.54 mm 排針',
    notes: ['板上有穩壓器與電平轉換，VIN 3–5 V，輸入腳 3–5 V 都安全（Adafruit）。', '裸晶片的 SDO 內部上拉，預設是 0x19；Adafruit 板子空接是 0x18。'],
    tbd: ['板上穩壓器與電平轉換的靜態電流（電流只算了晶片）。'],
  },
  'mpu6050-gy521': {
    name: 'MPU-6050 on a GY-521 module', zh: 'MPU-6050 六軸（GY-521 模組）', kind: 'sensor',
    sources: [S.mpu6050, S.mpuPlayground],
    supply: { min: null, max: null, nominal: 5 },
    logic: { v: 3.3, vohMin: null, vih: [{ frac: 0.7 }], vinMax: null, fiveVoltSafe: null },
    current: { typ: 3.9, max: null },   // gyro + accel + DMP
    pins: {
      VCC: { kind: 'power-in', label: 'VCC' }, GND, SCL: { kind: 'i2c-scl', label: 'SCL' }, SDA: { kind: 'i2c-sda', label: 'SDA' },
      XDA: { kind: 'io', label: 'XDA' }, XCL: { kind: 'io', label: 'XCL' }, AD0: { kind: 'data-in', label: 'AD0' }, INT: { kind: 'data-out', label: 'INT' },
    },
    i2c: { addr: ['0x68', '0x69'], default: '0x68', select: 'AD0 接地＝0x68，接高＝0x69（MPU-6050 規格書）' },
    size: null, connector: '8 pin 排針',
    notes: ['晶片 VDD 2.375–3.46 V；GY-521 板上有穩壓器，Arduino Playground 建議 VCC 給 5 V。', 'I²C 上拉電阻在模組上（各批 10K 或 2.2K）。'],
    tbd: ['GY-521 的穩壓器型號、VCC 範圍、尺寸、腳位（沒有原廠文件）。', '模組上的 I²C 上拉接到哪個電壓。'],
  },
  // ------------------------------------------------------------------ lights
  ws2812b: {
    name: 'WS2812B addressable RGB LEDs (Worldsemi)', zh: 'WS2812B 燈條／燈珠', kind: 'light', leds: 1,
    sources: [S.ws2812b2013, S.ws2812bV5, ...NEO_SOURCES],
    supply: { min: 3.7, max: 5.3, nominal: 5 },   // 2013: 3.5–5.3 V, V5: 3.7–5.3 V (both under absolute maximum ratings): the stricter one
    logic: { v: null, vohMin: null, vih: VIH_WS2812B, vinMax: { aboveVdd: 0.5 }, fiveVoltSafe: true },
    perLed: { typ: 20, max: 60 },   // Adafruit: up to 60 mA per pixel at full white, ~20 mA as a rule of thumb
    pins: LED_PINS,
    size: { w: 5, h: 5.4, d: 1.57 }, connector: '燈條三線（5V、GND、DIN）',
    notes: ['供電下限各版不同：2013 版 3.5 V、V5 版 3.7 V（這裡用 3.7 V）。', '輸入高電位門檻：2013 版 0.7 × VDD、V5 版 2.7 V（這裡取比較嚴的）。', ...LED_NOTES],
    tbd: [],
  },
  sk6812: {
    name: 'SK6812 addressable LEDs (RGB / RGBW)', zh: 'SK6812 燈條／燈珠', kind: 'light', leds: 1,
    sources: [S.sk6812rgbw, S.sk6812rgb, ...NEO_SOURCES],
    supply: { min: 3.5, max: 5.5, nominal: 5 },   // RGBW sheet; the RGB sheet gives no range
    logic: { v: null, vohMin: null, vih: VIH_SK6812, vinMax: null, fiveVoltSafe: true },
    perLed: { typ: null, max: null },
    pins: LED_PINS,
    size: { w: 5, h: 5.5, d: 1.6 }, connector: '燈條三線（5V、GND、DIN）',
    notes: ['VDD 5 V 時輸入高電位要 3.4 V（規格書）；其他電壓這裡等比例推算。', 'RGBW 每顆 32 bit（RGB 是 24 bit），程式要選對型號。', ...LED_NOTES],
    tbd: ['每顆燈的電流（兩份規格書都沒寫）。', 'RGB 版的供電範圍。'],
  },
  'neopixel-ring-12': {
    name: 'Adafruit NeoPixel Ring 12 (1643)', zh: 'NeoPixel 12 顆燈環', kind: 'light', leds: 12,
    sources: [S.ring12, ...NEO_SOURCES, S.ws2812b2013, S.sk6812rgbw],
    supply: { min: 3.7, max: 5.3, nominal: 5 },   // ships with WS2812B or SK6812: the stricter of the two chips
    logic: { v: null, vohMin: null, vih: [...VIH_WS2812B, ...VIH_SK6812], vinMax: { aboveVdd: 0.5 }, fiveVoltSafe: true },
    perLed: { typ: 20, max: 60 },
    pins: LED_PINS,
    size: { w: 36.8, h: 36.8, d: 6.7, inner: 23.3 }, connector: '焊墊：5V、GND、DIN、DOUT',
    notes: ['出貨可能是 WS2812B 或 SK6812，電壓門檻取兩者比較嚴的。外徑 36.8 mm、內徑 23.3 mm。', ...LED_NOTES],
    tbd: ['整環最大電流（產品頁只寫每顆約 18 mA 定電流驅動；這裡用 Überguide 每顆 60 mA 全白估）。'],
  },
  'neopixel-ring-16': {
    name: 'Adafruit NeoPixel Ring 16 (1463)', zh: 'NeoPixel 16 顆燈環', kind: 'light', leds: 16,
    sources: [S.ring16, ...NEO_SOURCES, S.ws2812b2013, S.sk6812rgbw],
    supply: { min: 3.7, max: 5.3, nominal: 5 },
    logic: { v: null, vohMin: null, vih: [...VIH_WS2812B, ...VIH_SK6812], vinMax: { aboveVdd: 0.5 }, fiveVoltSafe: true },
    perLed: { typ: 20, max: 60 },
    pins: LED_PINS,
    size: { w: 44.5, h: 44.5, d: 6.7, inner: 31.7 }, connector: '焊墊：5V、GND、DIN、DOUT',
    notes: ['產品頁寫「5VDC（4–7V works）」，但燈珠規格書上限 5.3 V，這裡照規格書。外徑 44.5 mm、內徑 31.7 mm。', ...LED_NOTES],
    tbd: ['整環最大電流（同 12 顆燈環）。'],
  },
  // ------------------------------------------------------------------ power
  'lipo-1s': {
    name: 'LiPo 3.7 V single cell, JST-PH (Adafruit 258 / 1578)', zh: '3.7 V 鋰聚合物電池（JST-PH）', kind: 'power', mAh: 1200,
    sources: [S.lipo258, S.lipo1578, S.lipoVolt],
    supply: null,
    battery: { full: 4.2, nominal: 3.7, empty: 3.4, cutoff: 3.0, chargeMaxMa: 500 },
    current: { typ: 0, max: 0 },
    pins: { '+': { kind: 'bat', label: '+（紅）', aliases: ['BAT', 'VBAT', 'RED'] }, '-': { ...GND, label: '−（黑）', aliases: ['BLACK'] } },
    size: { w: 34, h: 62, d: 5 }, connector: 'JST-PH 2 pin',
    variants: { 1200: { size: { w: 34, h: 62, d: 5 }, g: 23 }, 500: { size: { w: 29, h: 36, d: 4.75 }, g: 10.5 } },
    notes: ['4.2 V 充滿、3.7 V 標稱；3.4 V 就算沒電，3.0 V 保護電路斷開（Adafruit）。內建過充、過放、短路保護，沒有溫度感測。'],
    bomNote: 'JST-PH 線序各家不統一：Adafruit 說別家的極性可能相反，會燒壞電池。接上板子前用電表確認紅線是 +。',
    tbd: ['最大放電電流（產品頁沒寫）。'],
  },
  'tp4056-usbc': {
    name: 'TP4056 USB-C LiPo charger module (with DW01A protection)', zh: 'TP4056 Type-C 鋰電池充電板', kind: 'power',
    sources: [S.tp4056, S.tp4056clone, S.dw01],
    supply: { min: 4, max: 8, nominal: 5 },
    charger: { part: 'TP4056', mA: null },
    current: { typ: 0, max: 0 },
    pins: {
      'IN+': { kind: 'power-in', label: 'IN+' }, 'IN-': { ...GND, label: 'IN−' },
      'B+': { kind: 'power-node', label: 'B+' }, 'B-': { ...GND, label: 'B−' },
      'OUT+': { kind: 'power-node', label: 'OUT+' }, 'OUT-': { ...GND, label: 'OUT−' },
    },
    size: null, connector: 'USB-C',
    notes: ['充到 4.2 V；充電電流由 PROG 電阻決定：原廠 TP4056 是 1.2K＝1 A、2.4K＝500 mA。', 'DW01 保護：過放 2.4 V、過充 4.3 V（典型值）。'],
    bomNote: '常見模組的 PROG 電阻多半設 1 A，超過小電池建議的充電電流（Adafruit 500 mAh 電池寫 500 mA 以下）：買來先看電阻值。仿製晶片 1K 就是 1 A、輸入上限只有 6.5 V。',
    tbd: ['模組腳位名稱與尺寸（沒有原廠）。', '各家模組的 PROG 電阻值。', 'FS8205A 規格。'],
  },
  'microlipo-usbc': {
    name: 'Adafruit Micro-Lipo charger USB-C (4410, MCP73831)', zh: 'Adafruit Micro-Lipo Type-C 充電板', kind: 'power',
    sources: [S.ada4410, S.mcp73831],
    supply: { min: null, max: null, nominal: 5 },
    charger: { part: 'MCP73831', mA: 100 },
    current: { typ: 0, max: 0 },
    pins: { '5V': { kind: 'power-in', label: '5V' }, GND, BAT: { kind: 'power-node', label: 'BAT' } },
    size: { w: 24, h: 19, d: 7.2 }, connector: 'USB-C；JST-PH 電池座',
    notes: ['預設 100 mA，焊上跳線改 500 mA（Adafruit）。沒有電池保護電路，靠電池自己的保護。'],
    tbd: ['5 V 輸入的範圍。'],
  },
  'qi-receiver': {
    name: 'Adafruit Universal Qi wireless receiver (1901)', zh: 'Qi 無線充電接收模組', kind: 'power',
    sources: [S.ada1901],
    supply: null,
    current: { typ: 0, max: 0 },
    pins: { 'V+': { kind: 'power-out', label: 'V+', v: [4.8, 5.2], limitMa: 500, when: 'charger', aliases: ['5V', 'VOUT', '+'] }, GND: { ...GND, aliases: ['-'] } },
    size: { w: 40, h: 29, d: null }, connector: '焊線',
    notes: ['輸出 4.8–5.2 V、500 mA（不是 1 A）。線圈 40 × 29 mm，要朝外貼著充電座。只吃 Qi 發射器。'],
    tbd: ['模組厚度。'],
  },
};
