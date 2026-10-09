/* eslint-disable */
// AUTOMATISCH ERZEUGT aus Lohnsteuer2026.xml (amtlicher PAP des BMF, Stand 2025-10-23 12:40) – nicht von Hand ändern.
// Neu erzeugen: node scripts/build-pap.js
// Eingaben wie im PAP (Beträge in Cent, KVZ in Prozent). Ausgaben: BigDecimal in Cent.
import { BigDecimal } from "./bigdecimal.js";

const TAB1 = [BigDecimal.ZERO, BigDecimal.valueOf( 0.4), BigDecimal.valueOf( 0.384), BigDecimal.valueOf( 0.368), BigDecimal.valueOf( 0.352), BigDecimal.valueOf( 0.336), BigDecimal.valueOf( 0.32), BigDecimal.valueOf( 0.304), BigDecimal.valueOf( 0.288), BigDecimal.valueOf( 0.272), BigDecimal.valueOf( 0.256), BigDecimal.valueOf( 0.24), BigDecimal.valueOf( 0.224), BigDecimal.valueOf( 0.208), BigDecimal.valueOf( 0.192), BigDecimal.valueOf( 0.176), BigDecimal.valueOf( 0.16), BigDecimal.valueOf( 0.152), BigDecimal.valueOf( 0.144), BigDecimal.valueOf( 0.14), BigDecimal.valueOf( 0.136), BigDecimal.valueOf( 0.132), BigDecimal.valueOf( 0.128), BigDecimal.valueOf( 0.124), BigDecimal.valueOf( 0.12), BigDecimal.valueOf( 0.116), BigDecimal.valueOf( 0.112), BigDecimal.valueOf( 0.108), BigDecimal.valueOf( 0.104), BigDecimal.valueOf( 0.1), BigDecimal.valueOf( 0.096), BigDecimal.valueOf( 0.092), BigDecimal.valueOf( 0.088), BigDecimal.valueOf( 0.084), BigDecimal.valueOf( 0.08), BigDecimal.valueOf( 0.076), BigDecimal.valueOf( 0.072), BigDecimal.valueOf( 0.068), BigDecimal.valueOf( 0.064), BigDecimal.valueOf( 0.06), BigDecimal.valueOf( 0.056), BigDecimal.valueOf( 0.052), BigDecimal.valueOf( 0.048), BigDecimal.valueOf( 0.044), BigDecimal.valueOf( 0.04), BigDecimal.valueOf( 0.036), BigDecimal.valueOf( 0.032), BigDecimal.valueOf( 0.028), BigDecimal.valueOf( 0.024), BigDecimal.valueOf( 0.02), BigDecimal.valueOf( 0.016), BigDecimal.valueOf( 0.012), BigDecimal.valueOf( 0.008), BigDecimal.valueOf( 0.004), BigDecimal.valueOf( 0)];
const TAB2 = [BigDecimal.ZERO, BigDecimal.valueOf( 3000), BigDecimal.valueOf( 2880), BigDecimal.valueOf( 2760), BigDecimal.valueOf( 2640), BigDecimal.valueOf( 2520), BigDecimal.valueOf( 2400), BigDecimal.valueOf( 2280), BigDecimal.valueOf( 2160), BigDecimal.valueOf( 2040), BigDecimal.valueOf( 1920), BigDecimal.valueOf( 1800), BigDecimal.valueOf( 1680), BigDecimal.valueOf( 1560), BigDecimal.valueOf( 1440), BigDecimal.valueOf( 1320), BigDecimal.valueOf( 1200), BigDecimal.valueOf( 1140), BigDecimal.valueOf( 1080), BigDecimal.valueOf( 1050), BigDecimal.valueOf( 1020), BigDecimal.valueOf( 990), BigDecimal.valueOf( 960), BigDecimal.valueOf( 930), BigDecimal.valueOf( 900), BigDecimal.valueOf( 870), BigDecimal.valueOf( 840), BigDecimal.valueOf( 810), BigDecimal.valueOf( 780), BigDecimal.valueOf( 750), BigDecimal.valueOf( 720), BigDecimal.valueOf( 690), BigDecimal.valueOf( 660), BigDecimal.valueOf( 630), BigDecimal.valueOf( 600), BigDecimal.valueOf( 570), BigDecimal.valueOf( 540), BigDecimal.valueOf( 510), BigDecimal.valueOf( 480), BigDecimal.valueOf( 450), BigDecimal.valueOf( 420), BigDecimal.valueOf( 390), BigDecimal.valueOf( 360), BigDecimal.valueOf( 330), BigDecimal.valueOf( 300), BigDecimal.valueOf( 270), BigDecimal.valueOf( 240), BigDecimal.valueOf( 210), BigDecimal.valueOf( 180), BigDecimal.valueOf( 150), BigDecimal.valueOf( 120), BigDecimal.valueOf( 90), BigDecimal.valueOf( 60), BigDecimal.valueOf( 30), BigDecimal.valueOf( 0) ];
const TAB3 = [BigDecimal.ZERO, BigDecimal.valueOf( 900), BigDecimal.valueOf( 864), BigDecimal.valueOf( 828), BigDecimal.valueOf( 792), BigDecimal.valueOf( 756), BigDecimal.valueOf( 720), BigDecimal.valueOf( 684), BigDecimal.valueOf( 648), BigDecimal.valueOf( 612), BigDecimal.valueOf( 576), BigDecimal.valueOf( 540), BigDecimal.valueOf( 504), BigDecimal.valueOf( 468), BigDecimal.valueOf( 432), BigDecimal.valueOf( 396), BigDecimal.valueOf( 360), BigDecimal.valueOf( 342), BigDecimal.valueOf( 324), BigDecimal.valueOf( 315), BigDecimal.valueOf( 306), BigDecimal.valueOf( 297), BigDecimal.valueOf( 288), BigDecimal.valueOf( 279), BigDecimal.valueOf( 270), BigDecimal.valueOf( 261), BigDecimal.valueOf( 252), BigDecimal.valueOf( 243), BigDecimal.valueOf( 234), BigDecimal.valueOf( 225), BigDecimal.valueOf( 216), BigDecimal.valueOf( 207), BigDecimal.valueOf( 198), BigDecimal.valueOf( 189), BigDecimal.valueOf( 180), BigDecimal.valueOf( 171), BigDecimal.valueOf( 162), BigDecimal.valueOf( 153), BigDecimal.valueOf( 144), BigDecimal.valueOf( 135), BigDecimal.valueOf( 126), BigDecimal.valueOf( 117), BigDecimal.valueOf( 108), BigDecimal.valueOf( 99), BigDecimal.valueOf( 90), BigDecimal.valueOf( 81), BigDecimal.valueOf( 72), BigDecimal.valueOf( 63), BigDecimal.valueOf( 54), BigDecimal.valueOf( 45), BigDecimal.valueOf( 36), BigDecimal.valueOf( 27), BigDecimal.valueOf( 18), BigDecimal.valueOf( 9), BigDecimal.valueOf( 0)];
const TAB4 = [BigDecimal.ZERO, BigDecimal.valueOf( 0.4), BigDecimal.valueOf( 0.384), BigDecimal.valueOf( 0.368), BigDecimal.valueOf( 0.352), BigDecimal.valueOf( 0.336), BigDecimal.valueOf( 0.32), BigDecimal.valueOf( 0.304), BigDecimal.valueOf( 0.288), BigDecimal.valueOf( 0.272), BigDecimal.valueOf( 0.256), BigDecimal.valueOf( 0.24), BigDecimal.valueOf( 0.224), BigDecimal.valueOf( 0.208), BigDecimal.valueOf( 0.192), BigDecimal.valueOf( 0.176), BigDecimal.valueOf( 0.16), BigDecimal.valueOf( 0.152), BigDecimal.valueOf( 0.144), BigDecimal.valueOf( 0.14), BigDecimal.valueOf( 0.136), BigDecimal.valueOf( 0.132), BigDecimal.valueOf( 0.128), BigDecimal.valueOf( 0.124), BigDecimal.valueOf( 0.12), BigDecimal.valueOf( 0.116), BigDecimal.valueOf( 0.112), BigDecimal.valueOf( 0.108), BigDecimal.valueOf( 0.104), BigDecimal.valueOf( 0.1), BigDecimal.valueOf( 0.096), BigDecimal.valueOf( 0.092), BigDecimal.valueOf( 0.088), BigDecimal.valueOf( 0.084), BigDecimal.valueOf( 0.08), BigDecimal.valueOf( 0.076), BigDecimal.valueOf( 0.072), BigDecimal.valueOf( 0.068), BigDecimal.valueOf( 0.064), BigDecimal.valueOf( 0.06), BigDecimal.valueOf( 0.056), BigDecimal.valueOf( 0.052), BigDecimal.valueOf( 0.048), BigDecimal.valueOf( 0.044), BigDecimal.valueOf( 0.04), BigDecimal.valueOf( 0.036), BigDecimal.valueOf( 0.032), BigDecimal.valueOf( 0.028), BigDecimal.valueOf( 0.024), BigDecimal.valueOf( 0.02), BigDecimal.valueOf( 0.016), BigDecimal.valueOf( 0.012), BigDecimal.valueOf( 0.008), BigDecimal.valueOf( 0.004), BigDecimal.valueOf( 0)];
const TAB5 = [BigDecimal.ZERO, BigDecimal.valueOf( 1900), BigDecimal.valueOf( 1824), BigDecimal.valueOf( 1748), BigDecimal.valueOf( 1672), BigDecimal.valueOf( 1596), BigDecimal.valueOf( 1520), BigDecimal.valueOf( 1444), BigDecimal.valueOf( 1368), BigDecimal.valueOf( 1292), BigDecimal.valueOf( 1216), BigDecimal.valueOf( 1140), BigDecimal.valueOf( 1064), BigDecimal.valueOf( 988), BigDecimal.valueOf( 912), BigDecimal.valueOf( 836), BigDecimal.valueOf( 760), BigDecimal.valueOf( 722), BigDecimal.valueOf( 684), BigDecimal.valueOf( 665), BigDecimal.valueOf( 646), BigDecimal.valueOf( 627), BigDecimal.valueOf( 608), BigDecimal.valueOf( 589), BigDecimal.valueOf( 570), BigDecimal.valueOf( 551), BigDecimal.valueOf( 532), BigDecimal.valueOf( 513), BigDecimal.valueOf( 494), BigDecimal.valueOf( 475), BigDecimal.valueOf( 456), BigDecimal.valueOf( 437), BigDecimal.valueOf( 418), BigDecimal.valueOf( 399), BigDecimal.valueOf( 380), BigDecimal.valueOf( 361), BigDecimal.valueOf( 342), BigDecimal.valueOf( 323), BigDecimal.valueOf( 304), BigDecimal.valueOf( 285), BigDecimal.valueOf( 266), BigDecimal.valueOf( 247), BigDecimal.valueOf( 228), BigDecimal.valueOf( 209), BigDecimal.valueOf( 190), BigDecimal.valueOf( 171), BigDecimal.valueOf( 152), BigDecimal.valueOf( 133), BigDecimal.valueOf( 114), BigDecimal.valueOf( 95), BigDecimal.valueOf( 76), BigDecimal.valueOf( 57), BigDecimal.valueOf( 38), BigDecimal.valueOf( 19), BigDecimal.valueOf( 0)];
const ZAHL1 = BigDecimal.ONE;
const ZAHL2 = BigDecimal.valueOf(2);
const ZAHL5 = BigDecimal.valueOf(5);
const ZAHL7 = BigDecimal.valueOf(7);
const ZAHL12 = BigDecimal.valueOf(12);
const ZAHL100 = BigDecimal.valueOf(100);
const ZAHL360 = BigDecimal.valueOf(360);
const ZAHL500 = BigDecimal.valueOf(500);
const ZAHL700 = BigDecimal.valueOf(700);
const ZAHL1000 = BigDecimal.valueOf(1000);
const ZAHL10000 = BigDecimal.valueOf(10000);

export const INPUTS = ["af","AJAHR","ALTER1","ALV","f","JFREIB","JHINZU","JRE4","JRE4ENT","JVBEZ","KRV","KVZ","LZZ","LZZFREIB","LZZHINZU","MBV","PKPV","PKPVAGZ","PKV","PVA","PVS","PVZ","R","RE4","SONSTB","SONSTENT","STERBE","STKL","VBEZ","VBEZM","VBEZS","VBS","VJAHR","ZKF","ZMVB"];

export function lohnsteuer2026(input = {}) {
  for (const k of Object.keys(input)) if (!INPUTS.includes(k)) throw new Error("Unbekannte PAP-Eingabe: " + k);
  const bd = (k, d) => (input[k] === undefined ? d : BigDecimal.valueOf(input[k]));
  const num = (k, d) => (input[k] === undefined ? d : Number(input[k]));
  let af = num("af", 1);
  let AJAHR = num("AJAHR", 0);
  let ALTER1 = num("ALTER1", 0);
  let ALV = num("ALV", 0);
  let f = num("f", 1.0);
  let JFREIB = bd("JFREIB", BigDecimal.ZERO);
  let JHINZU = bd("JHINZU", BigDecimal.ZERO);
  let JRE4 = bd("JRE4", BigDecimal.ZERO);
  let JRE4ENT = bd("JRE4ENT", BigDecimal.ZERO);
  let JVBEZ = bd("JVBEZ", BigDecimal.ZERO);
  let KRV = num("KRV", 0);
  let KVZ = bd("KVZ", BigDecimal.ZERO);
  let LZZ = num("LZZ", 1);
  let LZZFREIB = bd("LZZFREIB", BigDecimal.ZERO);
  let LZZHINZU = bd("LZZHINZU", BigDecimal.ZERO);
  let MBV = bd("MBV", BigDecimal.ZERO);
  let PKPV = bd("PKPV", BigDecimal.ZERO);
  let PKPVAGZ = bd("PKPVAGZ", BigDecimal.ZERO);
  let PKV = num("PKV", 0);
  let PVA = bd("PVA", BigDecimal.ZERO);
  let PVS = num("PVS", 0);
  let PVZ = num("PVZ", 0);
  let R = num("R", 0);
  let RE4 = bd("RE4", BigDecimal.ZERO);
  let SONSTB = bd("SONSTB", BigDecimal.ZERO);
  let SONSTENT = bd("SONSTENT", BigDecimal.ZERO);
  let STERBE = bd("STERBE", BigDecimal.ZERO);
  let STKL = num("STKL", 1);
  let VBEZ = bd("VBEZ", BigDecimal.ZERO);
  let VBEZM = bd("VBEZM", BigDecimal.ZERO);
  let VBEZS = bd("VBEZS", BigDecimal.ZERO);
  let VBS = bd("VBS", BigDecimal.ZERO);
  let VJAHR = num("VJAHR", 0);
  let ZKF = bd("ZKF", BigDecimal.ZERO);
  let ZMVB = num("ZMVB", 0);
  let BK = BigDecimal.ZERO;
  let BKS = BigDecimal.ZERO;
  let LSTLZZ = BigDecimal.ZERO;
  let SOLZLZZ = BigDecimal.ZERO;
  let SOLZS = BigDecimal.ZERO;
  let STS = BigDecimal.ZERO;
  let VFRB = BigDecimal.ZERO;
  let VFRBS1 = BigDecimal.ZERO;
  let VFRBS2 = BigDecimal.ZERO;
  let WVFRB = BigDecimal.ZERO;
  let WVFRBO = BigDecimal.ZERO;
  let WVFRBM = BigDecimal.ZERO;
  let ALTE = BigDecimal.ZERO;
  let ANP = BigDecimal.ZERO;
  let ANTEIL1 = BigDecimal.ZERO;
  let AVSATZAN = BigDecimal.ZERO;
  let BBGKVPV = BigDecimal.ZERO;
  let BBGRVALV = BigDecimal.ZERO;
  let BMG = BigDecimal.ZERO;
  let DIFF = BigDecimal.ZERO;
  let EFA = BigDecimal.ZERO;
  let FVB = BigDecimal.ZERO;
  let FVBSO = BigDecimal.ZERO;
  let FVBZ = BigDecimal.ZERO;
  let FVBZSO = BigDecimal.ZERO;
  let GFB = BigDecimal.ZERO;
  let HBALTE = BigDecimal.ZERO;
  let HFVB = BigDecimal.ZERO;
  let HFVBZ = BigDecimal.ZERO;
  let HFVBZSO = BigDecimal.ZERO;
  let HOCH = BigDecimal.ZERO;
  let J = 0;
  let JBMG = BigDecimal.ZERO;
  let JLFREIB = BigDecimal.ZERO;
  let JLHINZU = BigDecimal.ZERO;
  let JW = BigDecimal.ZERO;
  let K = 0;
  let KFB = BigDecimal.ZERO;
  let KVSATZAN = BigDecimal.ZERO;
  let KZTAB = 0;
  let LSTJAHR = BigDecimal.ZERO;
  let LSTOSO = BigDecimal.ZERO;
  let LSTSO = BigDecimal.ZERO;
  let MIST = BigDecimal.ZERO;
  let PKPVAGZJ = BigDecimal.ZERO;
  let PVSATZAN = BigDecimal.ZERO;
  let RVSATZAN = BigDecimal.ZERO;
  let RW = BigDecimal.ZERO;
  let SAP = BigDecimal.ZERO;
  let SOLZFREI = BigDecimal.ZERO;
  let SOLZJ = BigDecimal.ZERO;
  let SOLZMIN = BigDecimal.ZERO;
  let SOLZSBMG = BigDecimal.ZERO;
  let SOLZSZVE = BigDecimal.ZERO;
  let ST = BigDecimal.ZERO;
  let ST1 = BigDecimal.ZERO;
  let ST2 = BigDecimal.ZERO;
  let VBEZB = BigDecimal.ZERO;
  let VBEZBSO = BigDecimal.ZERO;
  let VERGL = BigDecimal.ZERO;
  let VSPHB = BigDecimal.ZERO;
  let VSP = BigDecimal.ZERO;
  let VSPN = BigDecimal.ZERO;
  let VSPALV = BigDecimal.ZERO;
  let VSPKVPV = BigDecimal.ZERO;
  let VSPR = BigDecimal.ZERO;
  let W1STKL5 = BigDecimal.ZERO;
  let W2STKL5 = BigDecimal.ZERO;
  let W3STKL5 = BigDecimal.ZERO;
  let X = BigDecimal.ZERO;
  let Y = BigDecimal.ZERO;
  let ZRE4 = BigDecimal.ZERO;
  let ZRE4J = BigDecimal.ZERO;
  let ZRE4VP = BigDecimal.ZERO;
  let ZRE4VPR = BigDecimal.ZERO;
  let ZTABFB = BigDecimal.ZERO;
  let ZVBEZ = BigDecimal.ZERO;
  let ZVBEZJ = BigDecimal.ZERO;
  let ZVE = BigDecimal.ZERO;
  let ZX = BigDecimal.ZERO;
  let ZZX = BigDecimal.ZERO;

  function MPARA() {
    BBGRVALV = BigDecimal.valueOf(101400);
    AVSATZAN = BigDecimal.valueOf(0.013);
    RVSATZAN = BigDecimal.valueOf(0.093);
    BBGKVPV = BigDecimal.valueOf(69750);
    KVSATZAN = (KVZ.divide(ZAHL2).divide(ZAHL100)).add(BigDecimal.valueOf(0.07));
    if (PVS == 1) {
      PVSATZAN = BigDecimal.valueOf(0.023);
    } else {
      PVSATZAN =  BigDecimal.valueOf(0.018);
    }
    if (PVZ == 1) {
      PVSATZAN = PVSATZAN.add(BigDecimal.valueOf(0.006));
    } else {
      PVSATZAN = PVSATZAN.subtract(PVA.multiply(BigDecimal.valueOf(0.0025)));
    }
    W1STKL5 = BigDecimal.valueOf(14071);
    W2STKL5 = BigDecimal.valueOf(34939);
    W3STKL5 = BigDecimal.valueOf(222260);
    GFB = BigDecimal.valueOf(12348);
    SOLZFREI = BigDecimal.valueOf(20350);
  }

  function MRE4JL() {
    if (LZZ == 1) {
      ZRE4J= RE4.divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
      ZVBEZJ= VBEZ.divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
      JLFREIB= LZZFREIB.divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
      JLHINZU= LZZHINZU.divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
    } else {
      if (LZZ == 2) {
        ZRE4J= (RE4.multiply (ZAHL12)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
        ZVBEZJ= (VBEZ.multiply (ZAHL12)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
        JLFREIB= (LZZFREIB.multiply (ZAHL12)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
        JLHINZU= (LZZHINZU.multiply (ZAHL12)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
      } else {
        if (LZZ == 3) {
          ZRE4J= (RE4.multiply (ZAHL360)).divide (ZAHL700, 2, BigDecimal.ROUND_DOWN);
          ZVBEZJ= (VBEZ.multiply (ZAHL360)).divide (ZAHL700, 2, BigDecimal.ROUND_DOWN);
          JLFREIB= (LZZFREIB.multiply (ZAHL360)).divide (ZAHL700, 2, BigDecimal.ROUND_DOWN);
          JLHINZU= (LZZHINZU.multiply (ZAHL360)).divide (ZAHL700, 2, BigDecimal.ROUND_DOWN);
        } else {
          ZRE4J= (RE4.multiply (ZAHL360)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
          ZVBEZJ= (VBEZ.multiply (ZAHL360)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
          JLFREIB= (LZZFREIB.multiply (ZAHL360)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
          JLHINZU= (LZZHINZU.multiply (ZAHL360)).divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
        }
      }
    }
    if (af == 0) {
      f= 1;
    }
  }

  function MRE4() {
    if (ZVBEZJ.compareTo (BigDecimal.ZERO) == 0) {
      FVBZ= BigDecimal.ZERO;
      FVB= BigDecimal.ZERO;
      FVBZSO= BigDecimal.ZERO;
      FVBSO= BigDecimal.ZERO;
    } else {
      if (VJAHR < 2006) {
        J= 1;
      } else {
        if (VJAHR < 2058) {
          J= VJAHR - 2004;
        } else {
          J= 54;
        }
      }
      if (LZZ == 1) {
        VBEZB= (VBEZM.multiply (BigDecimal.valueOf(ZMVB))).add (VBEZS);
        HFVB= TAB2[J].divide (ZAHL12).multiply (BigDecimal.valueOf(ZMVB)).setScale (0, BigDecimal.ROUND_UP);
        FVBZ= TAB3[J].divide (ZAHL12).multiply (BigDecimal.valueOf(ZMVB)).setScale (0, BigDecimal.ROUND_UP);
      } else {
        VBEZB= ((VBEZM.multiply (ZAHL12)).add (VBEZS)).setScale (2, BigDecimal.ROUND_DOWN);
        HFVB= TAB2[J];
        FVBZ= TAB3[J];
      }
      FVB= ((VBEZB.multiply (TAB1[J]))).divide (ZAHL100).setScale (2, BigDecimal.ROUND_UP);
      if (FVB.compareTo (HFVB) == 1) {
        FVB = HFVB;
      }
      if (FVB.compareTo (ZVBEZJ) == 1) {
        FVB = ZVBEZJ;
      }
      FVBSO= (FVB.add((VBEZBSO.multiply (TAB1[J])).divide (ZAHL100))).setScale (2, BigDecimal.ROUND_UP);
      if (FVBSO.compareTo (TAB2[J]) == 1) {
        FVBSO = TAB2[J];
      }
      HFVBZSO= (((VBEZB.add(VBEZBSO)).divide (ZAHL100)).subtract (FVBSO)).setScale (2, BigDecimal.ROUND_DOWN);
      FVBZSO= (FVBZ.add((VBEZBSO).divide (ZAHL100))).setScale (0, BigDecimal.ROUND_UP);
      if (FVBZSO.compareTo (HFVBZSO) == 1) {
        FVBZSO = HFVBZSO.setScale(0, BigDecimal.ROUND_UP);
      }
      if (FVBZSO.compareTo (TAB3[J]) == 1) {
        FVBZSO = TAB3[J];
      }
      HFVBZ= ((VBEZB.divide (ZAHL100)).subtract (FVB)).setScale (2, BigDecimal.ROUND_DOWN);
      if (FVBZ.compareTo (HFVBZ) == 1) {
        FVBZ = HFVBZ.setScale (0, BigDecimal.ROUND_UP);
      }
    }
    MRE4ALTE();
  }

  function MRE4ALTE() {
    if (ALTER1 == 0) {
      ALTE= BigDecimal.ZERO;
    } else {
      if (AJAHR < 2006) {
        K= 1;
      } else {
        if (AJAHR < 2058) {
          K= AJAHR - 2004;
        } else {
          K= 54;
        }
      }
      BMG= ZRE4J.subtract (ZVBEZJ);
      ALTE = (BMG.multiply(TAB4[K])).setScale(0, BigDecimal.ROUND_UP);
      HBALTE= TAB5[K];
      if (ALTE.compareTo (HBALTE) == 1) {
        ALTE= HBALTE;
      }
    }
  }

  function MRE4ABZ() {
    ZRE4= (ZRE4J.subtract (FVB).subtract   (ALTE).subtract (JLFREIB).add (JLHINZU)).setScale (2, BigDecimal.ROUND_DOWN);
    if (ZRE4.compareTo (BigDecimal.ZERO) == -1) {
      ZRE4= BigDecimal.ZERO;
    }
    ZRE4VP= ZRE4J;
    ZVBEZ = ZVBEZJ.subtract(FVB).setScale(2, BigDecimal.ROUND_DOWN);
    if (ZVBEZ.compareTo(BigDecimal.ZERO) == -1) {
      ZVBEZ = BigDecimal.ZERO;
    }
  }

  function MBERECH() {
    MZTABFB();
    VFRB = ((ANP.add(FVB.add(FVBZ))).multiply(ZAHL100)).setScale(0, BigDecimal.ROUND_DOWN);
    MLSTJAHR();
    WVFRB = ((ZVE.subtract(GFB)).multiply(ZAHL100)).setScale(0, BigDecimal.ROUND_DOWN);
    if (WVFRB.compareTo(BigDecimal.ZERO) == -1) {
      WVFRB = BigDecimal.ZERO;
    }
    LSTJAHR = (ST.multiply(BigDecimal.valueOf(f))).setScale(0,BigDecimal.ROUND_DOWN);
    UPLSTLZZ();
    if (ZKF.compareTo(BigDecimal.ZERO) == 1) {
      ZTABFB = ZTABFB.add(KFB);
      MRE4ABZ();
      MLSTJAHR();
      JBMG = (ST.multiply(BigDecimal.valueOf(f))).setScale(0,BigDecimal.ROUND_DOWN);
    } else {
      JBMG = LSTJAHR;
    }
    MSOLZ();
  }

  function MZTABFB() {
    ANP= BigDecimal.ZERO;
    if (ZVBEZ.compareTo (BigDecimal.ZERO) >= 0 && ZVBEZ.compareTo(FVBZ) == -1) {
      FVBZ = BigDecimal.valueOf(ZVBEZ.longValue());
    }
    if (STKL < 6) {
      if (ZVBEZ.compareTo (BigDecimal.ZERO) == 1) {
        if ((ZVBEZ.subtract (FVBZ)).compareTo (BigDecimal.valueOf(102)) == -1) {
          ANP= (ZVBEZ.subtract (FVBZ)).setScale (0, BigDecimal.ROUND_UP);
        } else {
          ANP= BigDecimal.valueOf(102);
        }
      }
    } else {
      FVBZ= BigDecimal.ZERO;
      FVBZSO= BigDecimal.ZERO;
    }
    if (STKL < 6) {
      if (ZRE4.compareTo(ZVBEZ) == 1) {
        if (ZRE4.subtract(ZVBEZ).compareTo(BigDecimal.valueOf(1230)) == -1) {
          ANP = ANP.add(ZRE4).subtract(ZVBEZ).setScale(0,BigDecimal.ROUND_UP);
        } else {
          ANP = ANP.add(BigDecimal.valueOf(1230));
        }
      }
    }
    KZTAB= 1;
    if (STKL == 1) {
      SAP= BigDecimal.valueOf(36);
      KFB= (ZKF.multiply (BigDecimal.valueOf(9756))).setScale (0, BigDecimal.ROUND_DOWN);
    } else {
      if (STKL == 2) {
        EFA= BigDecimal.valueOf(4260);
        SAP= BigDecimal.valueOf(36);
        KFB= (ZKF.multiply (BigDecimal.valueOf(9756))).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        if (STKL == 3) {
          KZTAB= 2;
          SAP= BigDecimal.valueOf(36);
          KFB= (ZKF.multiply (BigDecimal.valueOf(9756))).setScale (0, BigDecimal.ROUND_DOWN);
        } else {
          if (STKL == 4) {
            SAP= BigDecimal.valueOf(36);
            KFB= (ZKF.multiply (BigDecimal.valueOf(4878))).setScale (0, BigDecimal.ROUND_DOWN);
          } else {
            if (STKL == 5) {
              SAP= BigDecimal.valueOf(36);
              KFB= BigDecimal.ZERO;
            } else {
              KFB= BigDecimal.ZERO;
            }
          }
        }
      }
    }
    ZTABFB= (EFA.add (ANP).add (SAP).add (FVBZ)).setScale (2, BigDecimal.ROUND_DOWN);
  }

  function MLSTJAHR() {
    UPEVP();
    ZVE= ZRE4.subtract (ZTABFB).subtract(VSP);
    UPMLST();
  }

  function UPLSTLZZ() {
    JW = LSTJAHR.multiply(ZAHL100);
    UPANTEIL();
    LSTLZZ = ANTEIL1;
  }

  function UPMLST() {
    if (ZVE.compareTo (ZAHL1) == -1) {
      ZVE= BigDecimal.ZERO;
      X= BigDecimal.ZERO;
    } else {
      X= (ZVE.divide (BigDecimal.valueOf(KZTAB))).setScale (0, BigDecimal.ROUND_DOWN);
    }
    if (STKL < 5) {
      UPTAB26();
    } else {
      MST5_6();
    }
  }

  function UPEVP() {
    if (KRV == 1) {
      VSPR = BigDecimal.ZERO;
    } else {
      if (ZRE4VP.compareTo(BBGRVALV) == 1) {
        ZRE4VPR = BBGRVALV;
      } else {
        ZRE4VPR = ZRE4VP;
      }
      VSPR = (ZRE4VPR.multiply(RVSATZAN)).setScale(2,BigDecimal.ROUND_DOWN);
    }
    MVSPKVPV();
    if (ALV == 1) {
    } else {
      if (STKL == 6) {
      } else {
        MVSPHB();
      }
    }
  }

  function MVSPKVPV() {
    if (ZRE4VP.compareTo(BBGKVPV) == 1) {
      ZRE4VPR = BBGKVPV;
    } else {
      ZRE4VPR = ZRE4VP;
    }
    if (PKV > 0) {
      if (STKL == 6) {
        VSPKVPV = BigDecimal.ZERO;
      } else {
        PKPVAGZJ = PKPVAGZ.multiply(ZAHL12).divide(ZAHL100).setScale(2,BigDecimal.ROUND_DOWN);
        VSPKVPV = PKPV.multiply(ZAHL12).divide(ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
        VSPKVPV = VSPKVPV.subtract(PKPVAGZJ);
        if (VSPKVPV.compareTo(BigDecimal.ZERO) == -1) {
          VSPKVPV = BigDecimal.ZERO;
        }
      }
    } else {
      VSPKVPV = ZRE4VPR.multiply(KVSATZAN.add(PVSATZAN)).setScale(2, BigDecimal.ROUND_DOWN);
    }
    VSP = VSPKVPV.add(VSPR).setScale(0, BigDecimal.ROUND_UP);
  }

  function MVSPHB() {
    if (ZRE4VP.compareTo(BBGRVALV) == 1) {
      ZRE4VPR = BBGRVALV;
    } else {
      ZRE4VPR = ZRE4VP;
    }
    VSPALV = AVSATZAN.multiply(ZRE4VPR).setScale(2, BigDecimal.ROUND_DOWN);
    VSPHB = VSPALV.add(VSPKVPV).setScale(2, BigDecimal.ROUND_DOWN);
    if (VSPHB.compareTo(BigDecimal.valueOf(1900)) == 1) {
      VSPHB = BigDecimal.valueOf(1900);
    }
    VSPN = VSPR.add(VSPHB).setScale(0, BigDecimal.ROUND_UP);
    if (VSPN.compareTo(VSP) == 1) {
      VSP = VSPN;
    }
  }

  function MST5_6() {
    ZZX= X;
    if (ZZX.compareTo(W2STKL5) == 1) {
      ZX= W2STKL5;
      UP5_6();
      if (ZZX.compareTo (W3STKL5) == 1) {
        ST= (ST.add ((W3STKL5.subtract (W2STKL5)).multiply (BigDecimal.valueOf(0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
        ST= (ST.add ((ZZX.subtract (W3STKL5)).multiply (BigDecimal.valueOf(0.45)))).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        ST= (ST.add ((ZZX.subtract (W2STKL5)).multiply (BigDecimal.valueOf(0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
      }
    } else {
      ZX= ZZX;
      UP5_6();
      if (ZZX.compareTo (W1STKL5) == 1) {
        VERGL= ST;
        ZX= W1STKL5;
        UP5_6();
        HOCH= (ST.add ((ZZX.subtract (W1STKL5)).multiply (BigDecimal.valueOf(0.42)))).setScale (0, BigDecimal.ROUND_DOWN);
        if (HOCH.compareTo (VERGL) == -1) {
          ST= HOCH;
        } else {
          ST= VERGL;
        }
      }
    }
  }

  function UP5_6() {
    X= (ZX.multiply (BigDecimal.valueOf(1.25))).setScale (0, BigDecimal.ROUND_DOWN);
    UPTAB26();
    ST1= ST;
    X= (ZX.multiply (BigDecimal.valueOf(0.75))).setScale (0, BigDecimal.ROUND_DOWN);
    UPTAB26();
    ST2= ST;
    DIFF= (ST1.subtract (ST2)).multiply (ZAHL2);
    MIST= (ZX.multiply (BigDecimal.valueOf(0.14))).setScale (0, BigDecimal.ROUND_DOWN);
    if (MIST.compareTo (DIFF) == 1) {
      ST= MIST;
    } else {
      ST= DIFF;
    }
  }

  function MSOLZ() {
    SOLZFREI = (SOLZFREI.multiply(BigDecimal.valueOf(KZTAB)));
    if (JBMG.compareTo (SOLZFREI) == 1) {
      SOLZJ= (JBMG.multiply (BigDecimal.valueOf(5.5))).divide(ZAHL100).setScale(2, BigDecimal.ROUND_DOWN);
      SOLZMIN= (JBMG.subtract (SOLZFREI)).multiply (BigDecimal.valueOf(11.9)).divide (ZAHL100).setScale (2, BigDecimal.ROUND_DOWN);
      if (SOLZMIN.compareTo (SOLZJ) == -1) {
        SOLZJ= SOLZMIN;
      }
      JW= SOLZJ.multiply (ZAHL100).setScale (0, BigDecimal.ROUND_DOWN);
      UPANTEIL();
      SOLZLZZ= ANTEIL1;
    } else {
      SOLZLZZ= BigDecimal.ZERO;
    }
    if (R > 0) {
      JW= JBMG.multiply (ZAHL100);
      UPANTEIL();
      BK= ANTEIL1;
    } else {
      BK= BigDecimal.ZERO;
    }
  }

  function UPANTEIL() {
    if (LZZ == 1) {
      ANTEIL1= JW;
    } else {
      if (LZZ == 2) {
        ANTEIL1= JW.divide (ZAHL12, 0, BigDecimal.ROUND_DOWN);
      } else {
        if (LZZ == 3) {
          ANTEIL1= (JW.multiply (ZAHL7)).divide (ZAHL360, 0, BigDecimal.ROUND_DOWN);
        } else {
          ANTEIL1= JW.divide (ZAHL360, 0, BigDecimal.ROUND_DOWN);
        }
      }
    }
  }

  function MSONST() {
    LZZ = 1;
    if (ZMVB == 0) {
      ZMVB = 12;
    }
    if (SONSTB.compareTo (BigDecimal.ZERO) == 0 && MBV.compareTo (BigDecimal.ZERO) == 0) {
      LSTSO= BigDecimal.ZERO;
      STS= BigDecimal.ZERO;
      SOLZS= BigDecimal.ZERO;
      BKS= BigDecimal.ZERO;
    } else {
      MOSONST();
      ZRE4J= ((JRE4.add (SONSTB)).divide (ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      ZVBEZJ= ((JVBEZ.add (VBS)).divide (ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
      VBEZBSO= STERBE;
      MRE4SONST();
      MLSTJAHR();
      WVFRBM = (ZVE.subtract(GFB)).multiply(ZAHL100).setScale(2,BigDecimal.ROUND_DOWN);
      if (WVFRBM.compareTo(BigDecimal.ZERO) == -1) {
        WVFRBM = BigDecimal.ZERO;
      }
      LSTSO= ST.multiply (ZAHL100);
      STS = LSTSO.subtract(LSTOSO).multiply(BigDecimal.valueOf(f)).divide(ZAHL100, 0, BigDecimal.ROUND_DOWN).multiply(ZAHL100);
      STSMIN();
    }
  }

  function STSMIN() {
    if (STS.compareTo(BigDecimal.ZERO) == -1) {
      if (MBV.compareTo(BigDecimal.ZERO) == 0) {
      } else {
        LSTLZZ = LSTLZZ.add(STS);
        if (LSTLZZ.compareTo(BigDecimal.ZERO) == -1) {
          LSTLZZ = BigDecimal.ZERO;
        }
        SOLZLZZ = SOLZLZZ.add(STS.multiply(BigDecimal.valueOf(5.5).divide(ZAHL100))).setScale(0, BigDecimal.ROUND_DOWN);
        if (SOLZLZZ.compareTo(BigDecimal.ZERO) == -1) {
          SOLZLZZ = BigDecimal.ZERO;
        }
        BK = BK.add(STS);
        if (BK.compareTo(BigDecimal.ZERO) == -1) {
          BK = BigDecimal.ZERO;
        }
      }
      STS = BigDecimal.ZERO;
      SOLZS = BigDecimal.ZERO;
    } else {
      MSOLZSTS();
    }
    if (R > 0) {
      BKS = STS;
    } else {
      BKS = BigDecimal.ZERO;
    }
  }

  function MSOLZSTS() {
    if (ZKF.compareTo(BigDecimal.ZERO) == 1) {
      SOLZSZVE= ZVE.subtract(KFB);
    } else {
      SOLZSZVE= ZVE;
    }
    if (SOLZSZVE.compareTo(BigDecimal.ONE) == -1) {
      SOLZSZVE= BigDecimal.ZERO;
      X= BigDecimal.ZERO;
    } else {
      X= SOLZSZVE.divide(BigDecimal.valueOf(KZTAB), 0, BigDecimal.ROUND_DOWN);
    }
    if (STKL < 5) {
      UPTAB26();
    } else {
      MST5_6();
    }
    SOLZSBMG= ST.multiply(BigDecimal.valueOf(f)).setScale(0,BigDecimal.ROUND_DOWN);
    if (SOLZSBMG.compareTo(SOLZFREI) == 1) {
      SOLZS= STS.multiply(BigDecimal.valueOf(5.5)).divide(ZAHL100, 0, BigDecimal.ROUND_DOWN);
    } else {
      SOLZS= BigDecimal.ZERO;
    }
  }

  function MOSONST() {
    ZRE4J= (JRE4.divide (ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
    ZVBEZJ= (JVBEZ.divide (ZAHL100)).setScale (2, BigDecimal.ROUND_DOWN);
    JLFREIB= JFREIB.divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
    JLHINZU= JHINZU.divide (ZAHL100, 2, BigDecimal.ROUND_DOWN);
    MRE4();
    MRE4ABZ();
    ZRE4VP = ZRE4VP.subtract(JRE4ENT.divide(ZAHL100));
    MZTABFB();
    VFRBS1 = ((ANP.add(FVB.add(FVBZ))).multiply(ZAHL100)).setScale(2,BigDecimal.ROUND_DOWN);
    MLSTJAHR();
    WVFRBO = ((ZVE.subtract(GFB)).multiply(ZAHL100)).setScale(2, BigDecimal.ROUND_DOWN);
    if (WVFRBO.compareTo(BigDecimal.ZERO) == -1) {
      WVFRBO = BigDecimal.ZERO;
    }
    LSTOSO= ST.multiply (ZAHL100);
  }

  function MRE4SONST() {
    MRE4();
    FVB= FVBSO;
    MRE4ABZ();
    ZRE4VP = ZRE4VP.add(MBV.divide(ZAHL100)).subtract(JRE4ENT.divide(ZAHL100)).subtract(SONSTENT.divide(ZAHL100));
    FVBZ= FVBZSO;
    MZTABFB();
    VFRBS2 = ((((ANP.add(FVB).add(FVBZ))).multiply(ZAHL100))).subtract(VFRBS1);
  }

  function UPTAB26() {
    if (X.compareTo(GFB.add(ZAHL1)) == -1) {
      ST= BigDecimal.ZERO;
    } else {
      if (X.compareTo (BigDecimal.valueOf(17800)) == -1) {
        Y = (X.subtract(GFB)).divide(ZAHL10000, 6,BigDecimal.ROUND_DOWN);
        RW= Y.multiply (BigDecimal.valueOf(914.51));
        RW= RW.add (BigDecimal.valueOf(1400));
        ST= (RW.multiply (Y)).setScale (0, BigDecimal.ROUND_DOWN);
      } else {
        if (X.compareTo (BigDecimal.valueOf(69879)) == -1) {
          Y= (X.subtract (BigDecimal.valueOf(17799))).divide (ZAHL10000, 6, BigDecimal.ROUND_DOWN);
          RW= Y.multiply (BigDecimal.valueOf(173.1));
          RW= RW.add (BigDecimal.valueOf(2397));
          RW= RW.multiply (Y);
          ST= (RW.add (BigDecimal.valueOf(1034.87))).setScale (0, BigDecimal.ROUND_DOWN);
        } else {
          if (X.compareTo (BigDecimal.valueOf(277826)) == -1) {
            ST= ((X.multiply (BigDecimal.valueOf(0.42))).subtract (BigDecimal.valueOf(11135.63))).setScale (0, BigDecimal.ROUND_DOWN);
          } else {
            ST= ((X.multiply (BigDecimal.valueOf(0.45))).subtract (BigDecimal.valueOf(19470.38))).setScale (0, BigDecimal.ROUND_DOWN);
          }
        }
      }
    }
    ST= ST.multiply (BigDecimal.valueOf(KZTAB));
  }

  MPARA();
  MRE4JL();
  VBEZBSO= BigDecimal.ZERO;
  MRE4();
  MRE4ABZ();
  MBERECH();
  MSONST();
  return { BK, BKS, LSTLZZ, SOLZLZZ, SOLZS, STS, VFRB, VFRBS1, VFRBS2, WVFRB, WVFRBO, WVFRBM };
}
