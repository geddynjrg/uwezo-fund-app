/** County, constituency, and ward names from the Majuu portal database.
 * Loan names follow LAS kenya_counties_constituencies.json where they match.
 */
export type KenyaWard = { name: string; loanName: string };
export type KenyaConstituency = { name: string; loanName: string; wards: KenyaWard[] };
export type KenyaCounty = { code: number; name: string; loanName: string; constituencies: KenyaConstituency[] };

export const kenyaLocations: KenyaCounty[] = [
  {
    "code": 1,
    "name": "Mombasa",
    "loanName": "Mombasa",
    "constituencies": [
      {
        "name": "CHANGAMWE",
        "loanName": "Changamwe",
        "wards": [
          {
            "name": "AIRPORT",
            "loanName": "Airport"
          },
          {
            "name": "CHAANI",
            "loanName": "Chaani"
          },
          {
            "name": "CHANGAMWE",
            "loanName": "Changamwe"
          },
          {
            "name": "KIPEVU",
            "loanName": "Kipevu"
          },
          {
            "name": "PORT REITZ",
            "loanName": "Port Reitz"
          }
        ]
      },
      {
        "name": "JOMVU",
        "loanName": "Jomvu",
        "wards": [
          {
            "name": "JOMVU KUU",
            "loanName": "Jomvu Kuu"
          },
          {
            "name": "MIKINDANI",
            "loanName": "Mikindani"
          },
          {
            "name": "MIRITINI",
            "loanName": "Miritini"
          }
        ]
      },
      {
        "name": "KISAUNI",
        "loanName": "Kisauni",
        "wards": [
          {
            "name": "BAMBURI",
            "loanName": "Bamburi"
          },
          {
            "name": "JUNDA",
            "loanName": "Junda"
          },
          {
            "name": "MAGOGONI",
            "loanName": "Magogoni"
          },
          {
            "name": "MJAMBERE",
            "loanName": "Mjambere"
          },
          {
            "name": "MTOPANGA",
            "loanName": "Mtopanga"
          },
          {
            "name": "MWAKIRUNGE",
            "loanName": "Mwakirunge"
          },
          {
            "name": "SHANZU",
            "loanName": "Shanzu"
          }
        ]
      },
      {
        "name": "LIKONI",
        "loanName": "Likoni",
        "wards": [
          {
            "name": "BOFU",
            "loanName": "Bofu"
          },
          {
            "name": "LIKONI",
            "loanName": "Likoni"
          },
          {
            "name": "MTONGWE",
            "loanName": "Mtongwe"
          },
          {
            "name": "SHIKA ADABU",
            "loanName": "Shika Adabu"
          },
          {
            "name": "TIMBWANI",
            "loanName": "Timbwani"
          }
        ]
      },
      {
        "name": "MVITA",
        "loanName": "Mvita",
        "wards": [
          {
            "name": "MAJENGO",
            "loanName": "Majengo"
          },
          {
            "name": "MJI WA KALE/MAKADARA",
            "loanName": "Mji Wa Kale/makadara"
          },
          {
            "name": "SHIMANZI/GANJONI",
            "loanName": "Shimanzi/ganjoni"
          },
          {
            "name": "TONONOKA",
            "loanName": "Tononoka"
          },
          {
            "name": "TUDOR",
            "loanName": "Tudor"
          }
        ]
      },
      {
        "name": "NYALI",
        "loanName": "Nyali",
        "wards": [
          {
            "name": "FRERE TOWN",
            "loanName": "Frere Town"
          },
          {
            "name": "KADZANDANI",
            "loanName": "Kadzandani"
          },
          {
            "name": "KONGOWEA",
            "loanName": "Kongowea"
          },
          {
            "name": "MKOMANI",
            "loanName": "Mkomani"
          }
        ]
      }
    ]
  },
  {
    "code": 2,
    "name": "Kwale",
    "loanName": "Kwale",
    "constituencies": [
      {
        "name": "KINANGO",
        "loanName": "Kinango",
        "wards": [
          {
            "name": "CHENGONI/SAMBURU",
            "loanName": "Chengoni/samburu"
          },
          {
            "name": "KASEMENI",
            "loanName": "Kasemeni"
          },
          {
            "name": "KINANGO",
            "loanName": "Kinango"
          },
          {
            "name": "MACKINNON ROAD",
            "loanName": "Mackinnon Road"
          },
          {
            "name": "MWAVUMBO",
            "loanName": "Mwavumbo"
          },
          {
            "name": "NDAVAYA",
            "loanName": "Ndavaya"
          },
          {
            "name": "PUMA",
            "loanName": "Puma"
          }
        ]
      },
      {
        "name": "LUNGA LUNGA",
        "loanName": "Lunga Lunga",
        "wards": [
          {
            "name": "DZOMBO",
            "loanName": "Dzombo"
          },
          {
            "name": "MWERENI",
            "loanName": "Mwereni"
          },
          {
            "name": "PONGWE/KIKONENI",
            "loanName": "Pongwe/kikoneni"
          },
          {
            "name": "VANGA",
            "loanName": "Vanga"
          }
        ]
      },
      {
        "name": "MATUGA",
        "loanName": "Matuga",
        "wards": [
          {
            "name": "KUBO SOUTH",
            "loanName": "Kubo South"
          },
          {
            "name": "MKONGANI",
            "loanName": "Mkongani"
          },
          {
            "name": "TIWI",
            "loanName": "Tiwi"
          },
          {
            "name": "TSIMBA GOLINI",
            "loanName": "Tsimba Golini"
          },
          {
            "name": "WAA",
            "loanName": "Waa"
          }
        ]
      },
      {
        "name": "MSAMBWENI",
        "loanName": "Msambweni",
        "wards": [
          {
            "name": "GOMBATO BONGWE",
            "loanName": "Gombato Bongwe"
          },
          {
            "name": "KINONDO",
            "loanName": "Kinondo"
          },
          {
            "name": "RAMISI",
            "loanName": "Ramisi"
          },
          {
            "name": "UKUNDA",
            "loanName": "Ukunda"
          }
        ]
      }
    ]
  },
  {
    "code": 3,
    "name": "Kilifi",
    "loanName": "Kilifi",
    "constituencies": [
      {
        "name": "GANZE",
        "loanName": "Ganze",
        "wards": [
          {
            "name": "BAMBA",
            "loanName": "Bamba"
          },
          {
            "name": "GANZE",
            "loanName": "Ganze"
          },
          {
            "name": "JARIBUNI",
            "loanName": "Jaribuni"
          },
          {
            "name": "SOKOKE",
            "loanName": "Sokoke"
          }
        ]
      },
      {
        "name": "KALOLENI",
        "loanName": "Kaloleni",
        "wards": [
          {
            "name": "KALOLENI",
            "loanName": "Kaloleni"
          },
          {
            "name": "KAYAFUNGO",
            "loanName": "Kayafungo"
          },
          {
            "name": "MARIAKANI",
            "loanName": "Mariakani"
          },
          {
            "name": "MWANAMWINGA",
            "loanName": "Mwanamwinga"
          }
        ]
      },
      {
        "name": "KILIFI NORTH",
        "loanName": "Kilifi North",
        "wards": [
          {
            "name": "DABASO",
            "loanName": "Dabaso"
          },
          {
            "name": "KIBARANI",
            "loanName": "Kibarani"
          },
          {
            "name": "MATSANGONI",
            "loanName": "Matsangoni"
          },
          {
            "name": "MNARANI",
            "loanName": "Mnarani"
          },
          {
            "name": "SOKONI",
            "loanName": "Sokoni"
          },
          {
            "name": "TEZO",
            "loanName": "Tezo"
          },
          {
            "name": "WATAMU",
            "loanName": "Watamu"
          }
        ]
      },
      {
        "name": "KILIFI SOUTH",
        "loanName": "Kilifi South",
        "wards": [
          {
            "name": "CHASIMBA",
            "loanName": "Chasimba"
          },
          {
            "name": "JUNJU",
            "loanName": "Junju"
          },
          {
            "name": "MTEPENI",
            "loanName": "Mtepeni"
          },
          {
            "name": "MWARAKAYA",
            "loanName": "Mwarakaya"
          },
          {
            "name": "SHIMO LA TEWA",
            "loanName": "Shimo La Tewa"
          }
        ]
      },
      {
        "name": "MAGARINI",
        "loanName": "Magarini",
        "wards": [
          {
            "name": "ADU",
            "loanName": "Adu"
          },
          {
            "name": "GARASHI",
            "loanName": "Garashi"
          },
          {
            "name": "GONGONI",
            "loanName": "Gongoni"
          },
          {
            "name": "MAGARINI",
            "loanName": "Magarini"
          },
          {
            "name": "MARAFA",
            "loanName": "Marafa"
          },
          {
            "name": "SABAKI",
            "loanName": "Sabaki"
          }
        ]
      },
      {
        "name": "MALINDI",
        "loanName": "Malindi",
        "wards": [
          {
            "name": "GANDA",
            "loanName": "Ganda"
          },
          {
            "name": "JILORE",
            "loanName": "Jilore"
          },
          {
            "name": "KAKUYUNI",
            "loanName": "Kakuyuni"
          },
          {
            "name": "MALINDI TOWN",
            "loanName": "Malindi Town"
          },
          {
            "name": "SHELLA",
            "loanName": "Shella"
          }
        ]
      },
      {
        "name": "RABAI",
        "loanName": "Rabai",
        "wards": [
          {
            "name": "KAMBE/RIBE",
            "loanName": "Kambe/ribe"
          },
          {
            "name": "MWAWESA",
            "loanName": "Mwawesa"
          },
          {
            "name": "RABAI/KISURUTINI",
            "loanName": "Rabai/kisurutini"
          },
          {
            "name": "RURUMA",
            "loanName": "Ruruma"
          }
        ]
      }
    ]
  },
  {
    "code": 4,
    "name": "Tana River",
    "loanName": "Tana River",
    "constituencies": [
      {
        "name": "BURA",
        "loanName": "Bura",
        "wards": [
          {
            "name": "BANGALE",
            "loanName": "Bangale"
          },
          {
            "name": "CHEWELE",
            "loanName": "Chewele"
          },
          {
            "name": "HIRIMANI",
            "loanName": "Hirimani"
          },
          {
            "name": "MADOGO",
            "loanName": "Madogo"
          },
          {
            "name": "SALA",
            "loanName": "Sala"
          }
        ]
      },
      {
        "name": "GALOLE",
        "loanName": "Galole",
        "wards": [
          {
            "name": "CHEWANI",
            "loanName": "Chewani"
          },
          {
            "name": "KINAKOMBA",
            "loanName": "Kinakomba"
          },
          {
            "name": "MIKINDUNI",
            "loanName": "Mikinduni"
          },
          {
            "name": "WAYU",
            "loanName": "Wayu"
          }
        ]
      },
      {
        "name": "GARSEN",
        "loanName": "Garsen",
        "wards": [
          {
            "name": "GARSEN CENTRAL",
            "loanName": "Garsen Central"
          },
          {
            "name": "GARSEN NORTH",
            "loanName": "Garsen North"
          },
          {
            "name": "GARSEN SOUTH",
            "loanName": "Garsen South"
          },
          {
            "name": "GARSEN WEST",
            "loanName": "Garsen West"
          },
          {
            "name": "KIPINI EAST",
            "loanName": "Kipini East"
          },
          {
            "name": "KIPINI WEST",
            "loanName": "Kipini West"
          }
        ]
      }
    ]
  },
  {
    "code": 5,
    "name": "Lamu",
    "loanName": "Lamu",
    "constituencies": [
      {
        "name": "LAMU EAST",
        "loanName": "Lamu East",
        "wards": [
          {
            "name": "BASUBA",
            "loanName": "Basuba"
          },
          {
            "name": "FAZA",
            "loanName": "Faza"
          },
          {
            "name": "KIUNGA",
            "loanName": "Kiunga"
          }
        ]
      },
      {
        "name": "LAMU WEST",
        "loanName": "Lamu West",
        "wards": [
          {
            "name": "BAHARI",
            "loanName": "Bahari"
          },
          {
            "name": "HINDI",
            "loanName": "Hindi"
          },
          {
            "name": "HONGWE",
            "loanName": "Hongwe"
          },
          {
            "name": "MKOMANI",
            "loanName": "Mkomani"
          },
          {
            "name": "MKUNUMBI",
            "loanName": "Mkunumbi"
          },
          {
            "name": "SHELLA",
            "loanName": "Shella"
          },
          {
            "name": "WITU",
            "loanName": "Witu"
          }
        ]
      }
    ]
  },
  {
    "code": 6,
    "name": "Taita Taveta",
    "loanName": "Taita Taveta",
    "constituencies": [
      {
        "name": "MWATATE",
        "loanName": "Mwatate",
        "wards": [
          {
            "name": "BURA",
            "loanName": "Bura"
          },
          {
            "name": "CHAWIA",
            "loanName": "Chawia"
          },
          {
            "name": "MWATATE",
            "loanName": "Mwatate"
          },
          {
            "name": "WUSI/KISHAMBA",
            "loanName": "Wusi/kishamba"
          }
        ]
      },
      {
        "name": "TAVETA",
        "loanName": "Taveta",
        "wards": [
          {
            "name": "BOMANI",
            "loanName": "Bomani"
          },
          {
            "name": "CHALA",
            "loanName": "Chala"
          },
          {
            "name": "MAHOO",
            "loanName": "Mahoo"
          },
          {
            "name": "MATA",
            "loanName": "Mata"
          },
          {
            "name": "MBOGHONI",
            "loanName": "Mboghoni"
          }
        ]
      },
      {
        "name": "VOI",
        "loanName": "Voi",
        "wards": [
          {
            "name": "KALOLENI",
            "loanName": "Kaloleni"
          },
          {
            "name": "KASIGAU",
            "loanName": "Kasigau"
          },
          {
            "name": "MARUNGU",
            "loanName": "Marungu"
          },
          {
            "name": "MBOLOLO",
            "loanName": "Mbololo"
          },
          {
            "name": "NGOLIA",
            "loanName": "Ngolia"
          },
          {
            "name": "SAGALLA",
            "loanName": "Sagalla"
          }
        ]
      },
      {
        "name": "WUNDANYI",
        "loanName": "Wundanyi",
        "wards": [
          {
            "name": "MWANDA/MGANGE",
            "loanName": "Mwanda/mgange"
          },
          {
            "name": "WERUGHA",
            "loanName": "Werugha"
          },
          {
            "name": "WUMINGU/KISHUSHE",
            "loanName": "Wumingu/kishushe"
          },
          {
            "name": "WUNDANYI/MBALE",
            "loanName": "Wundanyi/mbale"
          }
        ]
      }
    ]
  },
  {
    "code": 7,
    "name": "Garissa",
    "loanName": "Garissa",
    "constituencies": [
      {
        "name": "BALAMBALA",
        "loanName": "Balambala",
        "wards": [
          {
            "name": "BALAMBALA",
            "loanName": "Balambala"
          },
          {
            "name": "DANYERE",
            "loanName": "Danyere"
          },
          {
            "name": "JARA JARA",
            "loanName": "Jara Jara"
          },
          {
            "name": "SAKA",
            "loanName": "Saka"
          },
          {
            "name": "SANKURI",
            "loanName": "Sankuri"
          }
        ]
      },
      {
        "name": "DADAAB",
        "loanName": "Dadaab",
        "wards": [
          {
            "name": "ABAKAILE",
            "loanName": "Abakaile"
          },
          {
            "name": "DADAAB",
            "loanName": "Dadaab"
          },
          {
            "name": "DAMAJALE",
            "loanName": "Damajale"
          },
          {
            "name": "DERTU",
            "loanName": "Dertu"
          },
          {
            "name": "LABASIGALE",
            "loanName": "Labasigale"
          },
          {
            "name": "LIBOI",
            "loanName": "Liboi"
          }
        ]
      },
      {
        "name": "FAFI",
        "loanName": "Fafi",
        "wards": [
          {
            "name": "BURA",
            "loanName": "Bura"
          },
          {
            "name": "DEKAHARIA",
            "loanName": "Dekaharia"
          },
          {
            "name": "FAFI",
            "loanName": "Fafi"
          },
          {
            "name": "JARAJILA",
            "loanName": "Jarajila"
          },
          {
            "name": "NANIGHI",
            "loanName": "Nanighi"
          }
        ]
      },
      {
        "name": "GARISSA TOWNSHIP",
        "loanName": "Garissa Township",
        "wards": [
          {
            "name": "GALBET",
            "loanName": "Galbet"
          },
          {
            "name": "IFTIN",
            "loanName": "Iftin"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          },
          {
            "name": "WABERI",
            "loanName": "Waberi"
          }
        ]
      },
      {
        "name": "IJARA",
        "loanName": "Ijara",
        "wards": [
          {
            "name": "HULUGHO",
            "loanName": "Hulugho"
          },
          {
            "name": "IJARA",
            "loanName": "Ijara"
          },
          {
            "name": "MASALANI",
            "loanName": "Masalani"
          },
          {
            "name": "SANGAILU",
            "loanName": "Sangailu"
          }
        ]
      },
      {
        "name": "LAGDERA",
        "loanName": "Lagdera",
        "wards": [
          {
            "name": "BARAKI",
            "loanName": "Baraki"
          },
          {
            "name": "BENANE",
            "loanName": "Benane"
          },
          {
            "name": "GOREALE",
            "loanName": "Goreale"
          },
          {
            "name": "MAALIMIN",
            "loanName": "Maalimin"
          },
          {
            "name": "MODOGASHE",
            "loanName": "Modogashe"
          },
          {
            "name": "SABENA",
            "loanName": "Sabena"
          }
        ]
      }
    ]
  },
  {
    "code": 8,
    "name": "Wajir",
    "loanName": "Wajir",
    "constituencies": [
      {
        "name": "ELDAS",
        "loanName": "Eldas",
        "wards": [
          {
            "name": "DELLA",
            "loanName": "Della"
          },
          {
            "name": "ELDAS",
            "loanName": "Eldas"
          },
          {
            "name": "ELNUR/TULA TULA",
            "loanName": "Elnur/tula Tula"
          },
          {
            "name": "LAKOLEY SOUTH/BASIR",
            "loanName": "Lakoley South/basir"
          }
        ]
      },
      {
        "name": "TARBAJ",
        "loanName": "Tarbaj",
        "wards": [
          {
            "name": "ELBEN",
            "loanName": "Elben"
          },
          {
            "name": "SARMAN",
            "loanName": "Sarman"
          },
          {
            "name": "TARBAJ",
            "loanName": "Tarbaj"
          },
          {
            "name": "WARGADUD",
            "loanName": "Wargadud"
          }
        ]
      },
      {
        "name": "WAJIR EAST",
        "loanName": "Wajir East",
        "wards": [
          {
            "name": "BARWAGO",
            "loanName": "Barwago"
          },
          {
            "name": "KHOROF/HARAR",
            "loanName": "Khorof/harar"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          },
          {
            "name": "WAGBERI",
            "loanName": "Wagberi"
          }
        ]
      },
      {
        "name": "WAJIR NORTH",
        "loanName": "Wajir North",
        "wards": [
          {
            "name": "BATALU",
            "loanName": "Batalu"
          },
          {
            "name": "BUTE",
            "loanName": "Bute"
          },
          {
            "name": "DANABA",
            "loanName": "Danaba"
          },
          {
            "name": "GODOMA",
            "loanName": "Godoma"
          },
          {
            "name": "GURAR",
            "loanName": "Gurar"
          },
          {
            "name": "KORONDILE",
            "loanName": "Korondile"
          },
          {
            "name": "MALKAGUFU",
            "loanName": "Malkagufu"
          }
        ]
      },
      {
        "name": "WAJIR SOUTH",
        "loanName": "Wajir South",
        "wards": [
          {
            "name": "BENANE",
            "loanName": "Benane"
          },
          {
            "name": "BURDER",
            "loanName": "Burder"
          },
          {
            "name": "DADAJA BULLA",
            "loanName": "Dadaja Bulla"
          },
          {
            "name": "DIIF",
            "loanName": "Diif"
          },
          {
            "name": "HABASSWEIN",
            "loanName": "Habasswein"
          },
          {
            "name": "IBRAHIM URE",
            "loanName": "Ibrahim Ure"
          },
          {
            "name": "LAGBOGHOL SOUTH",
            "loanName": "Lagboghol South"
          }
        ]
      },
      {
        "name": "WAJIR WEST",
        "loanName": "Wajir West",
        "wards": [
          {
            "name": "ADAMASAJIDE",
            "loanName": "Adamasajide"
          },
          {
            "name": "ARBAJAHAN",
            "loanName": "Arbajahan"
          },
          {
            "name": "GANYURE/WAGALLA",
            "loanName": "Ganyure/wagalla"
          },
          {
            "name": "HADADO/ATHIBOHOL",
            "loanName": "Hadado/athibohol"
          }
        ]
      }
    ]
  },
  {
    "code": 9,
    "name": "Mandera",
    "loanName": "Mandera",
    "constituencies": [
      {
        "name": "BANISSA",
        "loanName": "Banissa",
        "wards": [
          {
            "name": "BANISSA",
            "loanName": "Banissa"
          },
          {
            "name": "DERKHALE",
            "loanName": "Derkhale"
          },
          {
            "name": "GUBA",
            "loanName": "Guba"
          },
          {
            "name": "KILIWEHIRI",
            "loanName": "Kiliwehiri"
          },
          {
            "name": "MALKAMARI",
            "loanName": "Malkamari"
          }
        ]
      },
      {
        "name": "LAFEY",
        "loanName": "Lafey",
        "wards": [
          {
            "name": "ALANGO GOF",
            "loanName": "Alango Gof"
          },
          {
            "name": "FINO",
            "loanName": "Fino"
          },
          {
            "name": "LAFEY",
            "loanName": "Lafey"
          },
          {
            "name": "SALA",
            "loanName": "Sala"
          },
          {
            "name": "WARANQARA",
            "loanName": "Waranqara"
          }
        ]
      },
      {
        "name": "MANDERA EAST",
        "loanName": "Mandera East",
        "wards": [
          {
            "name": "ARABIA",
            "loanName": "Arabia"
          },
          {
            "name": "KHALALIO",
            "loanName": "Khalalio"
          },
          {
            "name": "LIBEHIA",
            "loanName": "Libehia"
          },
          {
            "name": "NEBOI",
            "loanName": "Neboi"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          }
        ]
      },
      {
        "name": "MANDERA NORTH",
        "loanName": "Mandera North",
        "wards": [
          {
            "name": "ASHABITO",
            "loanName": "Ashabito"
          },
          {
            "name": "GUTICHA",
            "loanName": "Guticha"
          },
          {
            "name": "MOROTHILE",
            "loanName": "Morothile"
          },
          {
            "name": "RHAMU",
            "loanName": "Rhamu"
          },
          {
            "name": "RHAMU-DIMTU",
            "loanName": "Rhamu-dimtu"
          }
        ]
      },
      {
        "name": "MANDERA SOUTH",
        "loanName": "Mandera South",
        "wards": [
          {
            "name": "ELWAK NORTH",
            "loanName": "Elwak North"
          },
          {
            "name": "ELWAK SOUTH",
            "loanName": "Elwak South"
          },
          {
            "name": "KUTULO",
            "loanName": "Kutulo"
          },
          {
            "name": "SHIMBIR FATUMA",
            "loanName": "Shimbir Fatuma"
          },
          {
            "name": "WARGADUD",
            "loanName": "Wargadud"
          }
        ]
      },
      {
        "name": "MANDERA WEST",
        "loanName": "Mandera West",
        "wards": [
          {
            "name": "DANDU",
            "loanName": "Dandu"
          },
          {
            "name": "GITHER",
            "loanName": "Gither"
          },
          {
            "name": "LAGSURE",
            "loanName": "Lagsure"
          },
          {
            "name": "TAKABA",
            "loanName": "Takaba"
          },
          {
            "name": "TAKABA SOUTH",
            "loanName": "Takaba South"
          }
        ]
      }
    ]
  },
  {
    "code": 10,
    "name": "Marsabit",
    "loanName": "Marsabit",
    "constituencies": [
      {
        "name": "LAISAMIS",
        "loanName": "Laisamis",
        "wards": [
          {
            "name": "KARGI/SOUTH HORR",
            "loanName": "Kargi/south Horr"
          },
          {
            "name": "KORR/NGURUNIT",
            "loanName": "Korr/ngurunit"
          },
          {
            "name": "LAISAMIS",
            "loanName": "Laisamis"
          },
          {
            "name": "LOGO LOGO",
            "loanName": "Logo Logo"
          },
          {
            "name": "LOIYANGALANI",
            "loanName": "Loiyangalani"
          }
        ]
      },
      {
        "name": "MOYALE",
        "loanName": "Moyale",
        "wards": [
          {
            "name": "BUTIYE",
            "loanName": "Butiye"
          },
          {
            "name": "GOLBO",
            "loanName": "Golbo"
          },
          {
            "name": "HEILLU/MANYATTA",
            "loanName": "Heillu/manyatta"
          },
          {
            "name": "MOYALE TOWNSHIP",
            "loanName": "Moyale Township"
          },
          {
            "name": "OBBU",
            "loanName": "Obbu"
          },
          {
            "name": "SOLOLO",
            "loanName": "Sololo"
          },
          {
            "name": "URAN",
            "loanName": "Uran"
          }
        ]
      },
      {
        "name": "NORTH HORR",
        "loanName": "North Horr",
        "wards": [
          {
            "name": "DUKANA",
            "loanName": "Dukana"
          },
          {
            "name": "ILLERET",
            "loanName": "Illeret"
          },
          {
            "name": "MAIKONA",
            "loanName": "Maikona"
          },
          {
            "name": "NORTH HORR",
            "loanName": "North Horr"
          },
          {
            "name": "TURBI",
            "loanName": "Turbi"
          }
        ]
      },
      {
        "name": "SAKU",
        "loanName": "Saku",
        "wards": [
          {
            "name": "KARARE",
            "loanName": "Karare"
          },
          {
            "name": "MARSABIT CENTRAL",
            "loanName": "Marsabit Central"
          },
          {
            "name": "SAGANTE/JALDESA",
            "loanName": "Sagante/jaldesa"
          }
        ]
      }
    ]
  },
  {
    "code": 11,
    "name": "Isiolo",
    "loanName": "Isiolo",
    "constituencies": [
      {
        "name": "ISIOLO NORTH",
        "loanName": "Isiolo North",
        "wards": [
          {
            "name": "BULLA PESA",
            "loanName": "Bulla Pesa"
          },
          {
            "name": "BURAT",
            "loanName": "Burat"
          },
          {
            "name": "CHARI",
            "loanName": "Chari"
          },
          {
            "name": "CHERAB",
            "loanName": "Cherab"
          },
          {
            "name": "NGARE MARA",
            "loanName": "Ngare Mara"
          },
          {
            "name": "OLDO/NYIRO",
            "loanName": "Oldo/nyiro"
          },
          {
            "name": "WABERA",
            "loanName": "Wabera"
          }
        ]
      },
      {
        "name": "ISIOLO SOUTH",
        "loanName": "Isiolo South",
        "wards": [
          {
            "name": "GARBATULLA",
            "loanName": "Garbatulla"
          },
          {
            "name": "KINNA",
            "loanName": "Kinna"
          },
          {
            "name": "SERICHO",
            "loanName": "Sericho"
          }
        ]
      }
    ]
  },
  {
    "code": 12,
    "name": "Meru",
    "loanName": "Meru",
    "constituencies": [
      {
        "name": "BUURI",
        "loanName": "Buuri",
        "wards": [
          {
            "name": "KIBIRICHIA",
            "loanName": "Kibirichia"
          },
          {
            "name": "KIIRUA/NAARI",
            "loanName": "Kiirua/naari"
          },
          {
            "name": "KISIMA",
            "loanName": "Kisima"
          },
          {
            "name": "RUIRI/RWARERA",
            "loanName": "Ruiri/rwarera"
          },
          {
            "name": "TIMAU",
            "loanName": "Timau"
          }
        ]
      },
      {
        "name": "CENTRAL IMENTI",
        "loanName": "Central Imenti",
        "wards": [
          {
            "name": "ABOTHUGUCHI CENTRAL",
            "loanName": "Abothuguchi Central"
          },
          {
            "name": "ABOTHUGUCHI WEST",
            "loanName": "Abothuguchi West"
          },
          {
            "name": "KIAGU",
            "loanName": "Kiagu"
          },
          {
            "name": "MWANGANTHIA",
            "loanName": "Mwanganthia"
          }
        ]
      },
      {
        "name": "IGEMBE CENTRAL",
        "loanName": "Igembe Central",
        "wards": [
          {
            "name": "ATHIRU RUUJINE",
            "loanName": "Athiru Ruujine"
          },
          {
            "name": "IGEMBE EAST",
            "loanName": "Igembe East"
          },
          {
            "name": "KANGETA",
            "loanName": "Kangeta"
          },
          {
            "name": "NJIA",
            "loanName": "Njia"
          }
        ]
      },
      {
        "name": "IGEMBE NORTH",
        "loanName": "Igembe North",
        "wards": [
          {
            "name": "AMWATHI",
            "loanName": "Amwathi"
          },
          {
            "name": "ANTUAMBUI",
            "loanName": "Antuambui"
          },
          {
            "name": "ANTUBETWE KIONGO",
            "loanName": "Antubetwe Kiongo"
          },
          {
            "name": "NAATHU",
            "loanName": "Naathu"
          },
          {
            "name": "NTUNENE",
            "loanName": "Ntunene"
          }
        ]
      },
      {
        "name": "IGEMBE SOUTH",
        "loanName": "Igembe South",
        "wards": [
          {
            "name": "AKACHIU",
            "loanName": "Akachiu"
          },
          {
            "name": "ATHIRU GAITI",
            "loanName": "Athiru Gaiti"
          },
          {
            "name": "KANUNI",
            "loanName": "Kanuni"
          },
          {
            "name": "KIEGOI/ANTUBOCHIU",
            "loanName": "Kiegoi/antubochiu"
          },
          {
            "name": "MAUA",
            "loanName": "Maua"
          }
        ]
      },
      {
        "name": "NORTH IMENTI",
        "loanName": "North Imenti",
        "wards": [
          {
            "name": "MUNICIPALITY",
            "loanName": "Municipality"
          },
          {
            "name": "NTIMA EAST",
            "loanName": "Ntima East"
          },
          {
            "name": "NTIMA WEST",
            "loanName": "Ntima West"
          },
          {
            "name": "NYAKI EAST",
            "loanName": "Nyaki East"
          },
          {
            "name": "NYAKI WEST",
            "loanName": "Nyaki West"
          }
        ]
      },
      {
        "name": "SOUTH IMENTI",
        "loanName": "South Imenti",
        "wards": [
          {
            "name": "ABOGETA EAST",
            "loanName": "Abogeta East"
          },
          {
            "name": "ABOGETA WEST",
            "loanName": "Abogeta West"
          },
          {
            "name": "IGOJI EAST",
            "loanName": "Igoji East"
          },
          {
            "name": "IGOJI WEST",
            "loanName": "Igoji West"
          },
          {
            "name": "MITUNGUU",
            "loanName": "Mitunguu"
          },
          {
            "name": "NKUENE",
            "loanName": "Nkuene"
          }
        ]
      },
      {
        "name": "TIGANIA EAST",
        "loanName": "Tigania East",
        "wards": [
          {
            "name": "KARAMA",
            "loanName": "Karama"
          },
          {
            "name": "KIGUCHWA",
            "loanName": "Kiguchwa"
          },
          {
            "name": "MIKINDURI",
            "loanName": "Mikinduri"
          },
          {
            "name": "MUTHARA",
            "loanName": "Muthara"
          },
          {
            "name": "THANGATHA",
            "loanName": "Thangatha"
          }
        ]
      },
      {
        "name": "TIGANIA WEST",
        "loanName": "Tigania West",
        "wards": [
          {
            "name": "AKITHII",
            "loanName": "Akithii"
          },
          {
            "name": "ATHWANA",
            "loanName": "Athwana"
          },
          {
            "name": "KIANJAI",
            "loanName": "Kianjai"
          },
          {
            "name": "MBEU",
            "loanName": "Mbeu"
          },
          {
            "name": "NKOMO",
            "loanName": "Nkomo"
          }
        ]
      }
    ]
  },
  {
    "code": 13,
    "name": "Tharaka - Nithi",
    "loanName": "Tharaka Nithi",
    "constituencies": [
      {
        "name": "CHUKA/IGAMBANG'OMBE",
        "loanName": "Chuka/Igambang'ombe",
        "wards": [
          {
            "name": "IGAMBANG'OMBE",
            "loanName": "Igambang'ombe"
          },
          {
            "name": "KARINGANI",
            "loanName": "Karingani"
          },
          {
            "name": "MAGUMONI",
            "loanName": "Magumoni"
          },
          {
            "name": "MARIANI",
            "loanName": "Mariani"
          },
          {
            "name": "MUGWE",
            "loanName": "Mugwe"
          }
        ]
      },
      {
        "name": "MAARA",
        "loanName": "Maara",
        "wards": [
          {
            "name": "CHOGORIA",
            "loanName": "Chogoria"
          },
          {
            "name": "GANGA",
            "loanName": "Ganga"
          },
          {
            "name": "MITHERU",
            "loanName": "Mitheru"
          },
          {
            "name": "MUTHAMBI",
            "loanName": "Muthambi"
          },
          {
            "name": "MWIMBI",
            "loanName": "Mwimbi"
          }
        ]
      },
      {
        "name": "THARAKA",
        "loanName": "Tharaka",
        "wards": [
          {
            "name": "CHIAKARIGA",
            "loanName": "Chiakariga"
          },
          {
            "name": "GATUNGA",
            "loanName": "Gatunga"
          },
          {
            "name": "MARIMANTI",
            "loanName": "Marimanti"
          },
          {
            "name": "MUKOTHIMA",
            "loanName": "Mukothima"
          },
          {
            "name": "NKONDI",
            "loanName": "Nkondi"
          }
        ]
      }
    ]
  },
  {
    "code": 14,
    "name": "Embu",
    "loanName": "Embu",
    "constituencies": [
      {
        "name": "MANYATTA",
        "loanName": "Manyatta",
        "wards": [
          {
            "name": "GATURI SOUTH",
            "loanName": "Gaturi South"
          },
          {
            "name": "KIRIMARI",
            "loanName": "Kirimari"
          },
          {
            "name": "KITHIMU",
            "loanName": "Kithimu"
          },
          {
            "name": "MBETI NORTH",
            "loanName": "Mbeti North"
          },
          {
            "name": "NGINDA",
            "loanName": "Nginda"
          },
          {
            "name": "RUGURU/NGANDORI",
            "loanName": "Ruguru/ngandori"
          }
        ]
      },
      {
        "name": "MBEERE NORTH",
        "loanName": "Mbeere North",
        "wards": [
          {
            "name": "EVURORE",
            "loanName": "Evurore"
          },
          {
            "name": "MUMINJI",
            "loanName": "Muminji"
          },
          {
            "name": "NTHAWA",
            "loanName": "Nthawa"
          }
        ]
      },
      {
        "name": "MBEERE SOUTH",
        "loanName": "Mbeere South",
        "wards": [
          {
            "name": "KIAMBERE",
            "loanName": "Kiambere"
          },
          {
            "name": "MAKIMA",
            "loanName": "Makima"
          },
          {
            "name": "MAVURIA",
            "loanName": "Mavuria"
          },
          {
            "name": "MBETI SOUTH",
            "loanName": "Mbeti South"
          },
          {
            "name": "MWEA",
            "loanName": "Mwea"
          }
        ]
      },
      {
        "name": "RUNYENJES",
        "loanName": "Runyenjes",
        "wards": [
          {
            "name": "CENTRAL WARD",
            "loanName": "Central Ward"
          },
          {
            "name": "GATURI NORTH",
            "loanName": "Gaturi North"
          },
          {
            "name": "KAGAARI NORTH",
            "loanName": "Kagaari North"
          },
          {
            "name": "KAGAARI SOUTH",
            "loanName": "Kagaari South"
          },
          {
            "name": "KYENI NORTH",
            "loanName": "Kyeni North"
          },
          {
            "name": "KYENI SOUTH",
            "loanName": "Kyeni South"
          }
        ]
      }
    ]
  },
  {
    "code": 15,
    "name": "Kitui",
    "loanName": "Kitui",
    "constituencies": [
      {
        "name": "KITUI CENTRAL",
        "loanName": "Kitui Central",
        "wards": [
          {
            "name": "KYANGWITHYA EAST",
            "loanName": "Kyangwithya East"
          },
          {
            "name": "KYANGWITHYA WEST",
            "loanName": "Kyangwithya West"
          },
          {
            "name": "MIAMBANI",
            "loanName": "Miambani"
          },
          {
            "name": "MULANGO",
            "loanName": "Mulango"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          }
        ]
      },
      {
        "name": "KITUI EAST",
        "loanName": "Kitui East",
        "wards": [
          {
            "name": "CHULUNI",
            "loanName": "Chuluni"
          },
          {
            "name": "ENDAU/MALALANI",
            "loanName": "Endau/malalani"
          },
          {
            "name": "MUTITO/KALIKU",
            "loanName": "Mutito/kaliku"
          },
          {
            "name": "NZAMBANI",
            "loanName": "Nzambani"
          },
          {
            "name": "VOO/KYAMATU",
            "loanName": "Voo/kyamatu"
          },
          {
            "name": "ZOMBE/MWITIKA",
            "loanName": "Zombe/mwitika"
          }
        ]
      },
      {
        "name": "KITUI RURAL",
        "loanName": "Kitui Rural",
        "wards": [
          {
            "name": "KANYANGI",
            "loanName": "Kanyangi"
          },
          {
            "name": "KISASI",
            "loanName": "Kisasi"
          },
          {
            "name": "KWAVONZA/YATTA",
            "loanName": "Kwavonza/yatta"
          },
          {
            "name": "MBITINI",
            "loanName": "Mbitini"
          }
        ]
      },
      {
        "name": "KITUI SOUTH",
        "loanName": "Kitui South",
        "wards": [
          {
            "name": "ATHI",
            "loanName": "Athi"
          },
          {
            "name": "IKANGA/KYATUNE",
            "loanName": "Ikanga/kyatune"
          },
          {
            "name": "IKUTHA",
            "loanName": "Ikutha"
          },
          {
            "name": "KANZIKO",
            "loanName": "Kanziko"
          },
          {
            "name": "MUTHA",
            "loanName": "Mutha"
          },
          {
            "name": "MUTOMO",
            "loanName": "Mutomo"
          }
        ]
      },
      {
        "name": "KITUI WEST",
        "loanName": "Kitui West",
        "wards": [
          {
            "name": "KAUWI",
            "loanName": "Kauwi"
          },
          {
            "name": "KWA MUTONGA/KITHUMULA",
            "loanName": "Kwa Mutonga/kithumula"
          },
          {
            "name": "MATINYANI",
            "loanName": "Matinyani"
          },
          {
            "name": "MUTONGUNI",
            "loanName": "Mutonguni"
          }
        ]
      },
      {
        "name": "MWINGI CENTRAL",
        "loanName": "Mwingi Central",
        "wards": [
          {
            "name": "CENTRAL",
            "loanName": "Central"
          },
          {
            "name": "KIVOU",
            "loanName": "Kivou"
          },
          {
            "name": "MUI",
            "loanName": "Mui"
          },
          {
            "name": "NGUNI",
            "loanName": "Nguni"
          },
          {
            "name": "NUU",
            "loanName": "Nuu"
          },
          {
            "name": "WAITA",
            "loanName": "Waita"
          }
        ]
      },
      {
        "name": "MWINGI NORTH",
        "loanName": "Mwingi North",
        "wards": [
          {
            "name": "KYUSO",
            "loanName": "Kyuso"
          },
          {
            "name": "MUMONI",
            "loanName": "Mumoni"
          },
          {
            "name": "NGOMENI",
            "loanName": "Ngomeni"
          },
          {
            "name": "THARAKA",
            "loanName": "Tharaka"
          },
          {
            "name": "TSEIKURU",
            "loanName": "Tseikuru"
          }
        ]
      },
      {
        "name": "MWINGI WEST",
        "loanName": "Mwingi West",
        "wards": [
          {
            "name": "KIOMO/KYETHANI",
            "loanName": "Kiomo/kyethani"
          },
          {
            "name": "KYOME/THAANA",
            "loanName": "Kyome/thaana"
          },
          {
            "name": "MIGWANI",
            "loanName": "Migwani"
          },
          {
            "name": "NGUUTANI",
            "loanName": "Nguutani"
          }
        ]
      }
    ]
  },
  {
    "code": 16,
    "name": "Machakos",
    "loanName": "Machakos",
    "constituencies": [
      {
        "name": "KANGUNDO",
        "loanName": "Kangundo",
        "wards": [
          {
            "name": "KANGUNDO CENTRAL",
            "loanName": "Kangundo Central"
          },
          {
            "name": "KANGUNDO EAST",
            "loanName": "Kangundo East"
          },
          {
            "name": "KANGUNDO NORTH",
            "loanName": "Kangundo North"
          },
          {
            "name": "KANGUNDO WEST",
            "loanName": "Kangundo West"
          }
        ]
      },
      {
        "name": "KATHIANI",
        "loanName": "Kathiani",
        "wards": [
          {
            "name": "KATHIANI CENTRAL",
            "loanName": "Kathiani Central"
          },
          {
            "name": "LOWER KAEWA/KAANI",
            "loanName": "Lower Kaewa/kaani"
          },
          {
            "name": "MITABONI",
            "loanName": "Mitaboni"
          },
          {
            "name": "UPPER KAEWA/IVETI",
            "loanName": "Upper Kaewa/iveti"
          }
        ]
      },
      {
        "name": "MACHAKOS TOWN",
        "loanName": "Machakos Town",
        "wards": [
          {
            "name": "KALAMA",
            "loanName": "Kalama"
          },
          {
            "name": "KOLA",
            "loanName": "Kola"
          },
          {
            "name": "MACHAKOS CENTRAL",
            "loanName": "Machakos Central"
          },
          {
            "name": "MUA",
            "loanName": "Mua"
          },
          {
            "name": "MUMBUNI NORTH",
            "loanName": "Mumbuni North"
          },
          {
            "name": "MUTITUNI",
            "loanName": "Mutituni"
          },
          {
            "name": "MUVUTI/KIIMA-KIMWE",
            "loanName": "Muvuti/kiima-kimwe"
          }
        ]
      },
      {
        "name": "MASINGA",
        "loanName": "Masinga",
        "wards": [
          {
            "name": "EKALAKALA",
            "loanName": "Ekalakala"
          },
          {
            "name": "KIVAA",
            "loanName": "Kivaa"
          },
          {
            "name": "MASINGA CENTRAL",
            "loanName": "Masinga Central"
          },
          {
            "name": "MUTHESYA",
            "loanName": "Muthesya"
          },
          {
            "name": "NDITHINI",
            "loanName": "Ndithini"
          }
        ]
      },
      {
        "name": "MATUNGULU",
        "loanName": "Matungulu",
        "wards": [
          {
            "name": "KYELENI",
            "loanName": "Kyeleni"
          },
          {
            "name": "MATUNGULU EAST",
            "loanName": "Matungulu East"
          },
          {
            "name": "MATUNGULU NORTH",
            "loanName": "Matungulu North"
          },
          {
            "name": "MATUNGULU WEST",
            "loanName": "Matungulu West"
          },
          {
            "name": "TALA",
            "loanName": "Tala"
          }
        ]
      },
      {
        "name": "MAVOKO",
        "loanName": "Mavoko",
        "wards": [
          {
            "name": "ATHI RIVER",
            "loanName": "Athi River"
          },
          {
            "name": "KINANIE",
            "loanName": "Kinanie"
          },
          {
            "name": "MUTHWANI",
            "loanName": "Muthwani"
          },
          {
            "name": "SYOKIMAU/MULOLONGO",
            "loanName": "Syokimau/mulolongo"
          }
        ]
      },
      {
        "name": "MWALA",
        "loanName": "Mwala",
        "wards": [
          {
            "name": "KIBAUNI",
            "loanName": "Kibauni"
          },
          {
            "name": "MAKUTANO/ MWALA",
            "loanName": "Makutano/ Mwala"
          },
          {
            "name": "MASII",
            "loanName": "Masii"
          },
          {
            "name": "MBIUNI",
            "loanName": "Mbiuni"
          },
          {
            "name": "MUTHETHENI",
            "loanName": "Muthetheni"
          },
          {
            "name": "WAMUNYU",
            "loanName": "Wamunyu"
          }
        ]
      },
      {
        "name": "YATTA",
        "loanName": "Yatta",
        "wards": [
          {
            "name": "IKOMBE",
            "loanName": "Ikombe"
          },
          {
            "name": "KATANGI",
            "loanName": "Katangi"
          },
          {
            "name": "KITHIMANI",
            "loanName": "Kithimani"
          },
          {
            "name": "MATUU",
            "loanName": "Matuu"
          },
          {
            "name": "NDALANI",
            "loanName": "Ndalani"
          }
        ]
      }
    ]
  },
  {
    "code": 17,
    "name": "Makueni",
    "loanName": "Makueni",
    "constituencies": [
      {
        "name": "KAITI",
        "loanName": "Kaiti",
        "wards": [
          {
            "name": "ILIMA",
            "loanName": "Ilima"
          },
          {
            "name": "KEE",
            "loanName": "Kee"
          },
          {
            "name": "KILUNGU",
            "loanName": "Kilungu"
          },
          {
            "name": "UKIA",
            "loanName": "Ukia"
          }
        ]
      },
      {
        "name": "KIBWEZI EAST",
        "loanName": "Kibwezi East",
        "wards": [
          {
            "name": "IVINGONI/NZAMBANI",
            "loanName": "Ivingoni/nzambani"
          },
          {
            "name": "MASONGALENI",
            "loanName": "Masongaleni"
          },
          {
            "name": "MTITO ANDEI",
            "loanName": "Mtito Andei"
          },
          {
            "name": "THANGE",
            "loanName": "Thange"
          }
        ]
      },
      {
        "name": "KIBWEZI WEST",
        "loanName": "Kibwezi West",
        "wards": [
          {
            "name": "EMALI/MULALA",
            "loanName": "Emali/mulala"
          },
          {
            "name": "KIKUMBULYU NORTH",
            "loanName": "Kikumbulyu North"
          },
          {
            "name": "KIKUMBULYU SOUTH",
            "loanName": "Kikumbulyu South"
          },
          {
            "name": "MAKINDU",
            "loanName": "Makindu"
          },
          {
            "name": "NGUU/MASUMBA",
            "loanName": "Nguu/masumba"
          },
          {
            "name": "NGUUMO",
            "loanName": "Nguumo"
          }
        ]
      },
      {
        "name": "KILOME",
        "loanName": "Kilome",
        "wards": [
          {
            "name": "KASIKEU",
            "loanName": "Kasikeu"
          },
          {
            "name": "KIIMA KIU/KALANZONI",
            "loanName": "Kiima Kiu/kalanzoni"
          },
          {
            "name": "MUKAA",
            "loanName": "Mukaa"
          }
        ]
      },
      {
        "name": "MAKUENI",
        "loanName": "Makueni",
        "wards": [
          {
            "name": "KATHONZWENI",
            "loanName": "Kathonzweni"
          },
          {
            "name": "KITISE/KITHUKI",
            "loanName": "Kitise/kithuki"
          },
          {
            "name": "MAVINDINI",
            "loanName": "Mavindini"
          },
          {
            "name": "MBITINI",
            "loanName": "Mbitini"
          },
          {
            "name": "MUVAU/KIKUUMINI",
            "loanName": "Muvau/kikuumini"
          },
          {
            "name": "NZAUI/KILILI/KALAMBA",
            "loanName": "Nzaui/kilili/kalamba"
          },
          {
            "name": "WOTE",
            "loanName": "Wote"
          }
        ]
      },
      {
        "name": "MBOONI",
        "loanName": "Mbooni",
        "wards": [
          {
            "name": "KALAWA",
            "loanName": "Kalawa"
          },
          {
            "name": "KITETA/KISAU",
            "loanName": "Kiteta/kisau"
          },
          {
            "name": "KITHUNGO/KITUNDU",
            "loanName": "Kithungo/kitundu"
          },
          {
            "name": "MBOONI",
            "loanName": "Mbooni"
          },
          {
            "name": "TULIMANI",
            "loanName": "Tulimani"
          },
          {
            "name": "WAIA-KAKO",
            "loanName": "Waia-kako"
          }
        ]
      }
    ]
  },
  {
    "code": 18,
    "name": "Nyandarua",
    "loanName": "Nyandarua",
    "constituencies": [
      {
        "name": "KINANGOP",
        "loanName": "Kinangop",
        "wards": [
          {
            "name": "ENGINEER",
            "loanName": "Engineer"
          },
          {
            "name": "GATHARA",
            "loanName": "Gathara"
          },
          {
            "name": "GITHABAI",
            "loanName": "Githabai"
          },
          {
            "name": "MAGUMU",
            "loanName": "Magumu"
          },
          {
            "name": "MURUNGARU",
            "loanName": "Murungaru"
          },
          {
            "name": "NJABINI\\\\\\\\KIBURU",
            "loanName": "Njabini\\\\\\\\kiburu"
          },
          {
            "name": "NORTH KINANGOP",
            "loanName": "North Kinangop"
          },
          {
            "name": "NYAKIO",
            "loanName": "Nyakio"
          }
        ]
      },
      {
        "name": "KIPIPIRI",
        "loanName": "Kipipiri",
        "wards": [
          {
            "name": "GETA",
            "loanName": "Geta"
          },
          {
            "name": "GITHIORO",
            "loanName": "Githioro"
          },
          {
            "name": "KIPIPIRI",
            "loanName": "Kipipiri"
          },
          {
            "name": "WANJOHI",
            "loanName": "Wanjohi"
          }
        ]
      },
      {
        "name": "NDARAGWA",
        "loanName": "Ndaragwa",
        "wards": [
          {
            "name": "CENTRAL",
            "loanName": "Central"
          },
          {
            "name": "KIRIITA",
            "loanName": "Kiriita"
          },
          {
            "name": "LESHAU/PONDO",
            "loanName": "Leshau/pondo"
          },
          {
            "name": "SHAMATA",
            "loanName": "Shamata"
          }
        ]
      },
      {
        "name": "OL JOROK",
        "loanName": "Ol Jorok",
        "wards": [
          {
            "name": "CHARAGITA",
            "loanName": "Charagita"
          },
          {
            "name": "GATHANJI",
            "loanName": "Gathanji"
          },
          {
            "name": "GATIMU",
            "loanName": "Gatimu"
          },
          {
            "name": "WERU",
            "loanName": "Weru"
          }
        ]
      },
      {
        "name": "OL KALOU",
        "loanName": "Ol Kalou",
        "wards": [
          {
            "name": "KAIMBAGA",
            "loanName": "Kaimbaga"
          },
          {
            "name": "KANJUIRI RANGE",
            "loanName": "Kanjuiri Range"
          },
          {
            "name": "KARAU",
            "loanName": "Karau"
          },
          {
            "name": "MIRANGINE",
            "loanName": "Mirangine"
          },
          {
            "name": "RURII",
            "loanName": "Rurii"
          }
        ]
      }
    ]
  },
  {
    "code": 19,
    "name": "Nyeri",
    "loanName": "Nyeri",
    "constituencies": [
      {
        "name": "KIENI",
        "loanName": "Kieni",
        "wards": [
          {
            "name": "GAKAWA",
            "loanName": "Gakawa"
          },
          {
            "name": "GATARAKWA",
            "loanName": "Gatarakwa"
          },
          {
            "name": "KABARU",
            "loanName": "Kabaru"
          },
          {
            "name": "MUGUNDA",
            "loanName": "Mugunda"
          },
          {
            "name": "MWEIGA",
            "loanName": "Mweiga"
          },
          {
            "name": "MWIYOGO/ENDARASHA",
            "loanName": "Mwiyogo/endarasha"
          },
          {
            "name": "NAROMORU KIAMATHAGA",
            "loanName": "Naromoru Kiamathaga"
          },
          {
            "name": "THEGU RIVER",
            "loanName": "Thegu River"
          }
        ]
      },
      {
        "name": "MATHIRA",
        "loanName": "Mathira",
        "wards": [
          {
            "name": "IRIAINI",
            "loanName": "Iriaini"
          },
          {
            "name": "KARATINA TOWN",
            "loanName": "Karatina Town"
          },
          {
            "name": "KIRIMUKUYU",
            "loanName": "Kirimukuyu"
          },
          {
            "name": "KONYU",
            "loanName": "Konyu"
          },
          {
            "name": "MAGUTU",
            "loanName": "Magutu"
          },
          {
            "name": "RUGURU",
            "loanName": "Ruguru"
          }
        ]
      },
      {
        "name": "MUKURWEINI",
        "loanName": "Mukurweini",
        "wards": [
          {
            "name": "GIKONDI",
            "loanName": "Gikondi"
          },
          {
            "name": "MUKURWE-INI CENTRAL",
            "loanName": "Mukurwe-ini Central"
          },
          {
            "name": "MUKURWE-INI WEST",
            "loanName": "Mukurwe-ini West"
          },
          {
            "name": "RUGI",
            "loanName": "Rugi"
          }
        ]
      },
      {
        "name": "NYERI TOWN",
        "loanName": "Nyeri Town",
        "wards": [
          {
            "name": "GATITU/MURUGURU",
            "loanName": "Gatitu/muruguru"
          },
          {
            "name": "KAMAKWA/MUKARO",
            "loanName": "Kamakwa/mukaro"
          },
          {
            "name": "KIGANJO/MATHARI",
            "loanName": "Kiganjo/mathari"
          },
          {
            "name": "RWARE",
            "loanName": "Rware"
          }
        ]
      },
      {
        "name": "OTHAYA",
        "loanName": "Othaya",
        "wards": [
          {
            "name": "CHINGA",
            "loanName": "Chinga"
          },
          {
            "name": "IRIA-INI",
            "loanName": "Iria-ini"
          },
          {
            "name": "KARIMA",
            "loanName": "Karima"
          },
          {
            "name": "MAHIGA",
            "loanName": "Mahiga"
          }
        ]
      },
      {
        "name": "TETU",
        "loanName": "Tetu",
        "wards": [
          {
            "name": "AGUTHI-GAAKI",
            "loanName": "Aguthi-gaaki"
          },
          {
            "name": "DEDAN KIMANTHI",
            "loanName": "Dedan Kimanthi"
          },
          {
            "name": "WAMAGANA",
            "loanName": "Wamagana"
          }
        ]
      }
    ]
  },
  {
    "code": 20,
    "name": "Kirinyaga",
    "loanName": "Kirinyaga",
    "constituencies": [
      {
        "name": "GICHUGU",
        "loanName": "Gichugu",
        "wards": [
          {
            "name": "BARAGWI",
            "loanName": "Baragwi"
          },
          {
            "name": "KABARE",
            "loanName": "Kabare"
          },
          {
            "name": "KARUMANDI",
            "loanName": "Karumandi"
          },
          {
            "name": "NGARIAMA",
            "loanName": "Ngariama"
          },
          {
            "name": "NJUKIINI",
            "loanName": "Njukiini"
          }
        ]
      },
      {
        "name": "KIRINYAGA CENTRAL",
        "loanName": "Kirinyaga Central",
        "wards": [
          {
            "name": "INOI",
            "loanName": "Inoi"
          },
          {
            "name": "KANYEKINI",
            "loanName": "Kanyekini"
          },
          {
            "name": "KERUGOYA",
            "loanName": "Kerugoya"
          },
          {
            "name": "MUTIRA",
            "loanName": "Mutira"
          }
        ]
      },
      {
        "name": "MWEA",
        "loanName": "Mwea",
        "wards": [
          {
            "name": "GATHIGIRIRI",
            "loanName": "Gathigiriri"
          },
          {
            "name": "KANGAI",
            "loanName": "Kangai"
          },
          {
            "name": "MURINDUKO",
            "loanName": "Murinduko"
          },
          {
            "name": "MUTITHI",
            "loanName": "Mutithi"
          },
          {
            "name": "NYANGATI",
            "loanName": "Nyangati"
          },
          {
            "name": "TEBERE",
            "loanName": "Tebere"
          },
          {
            "name": "THIBA",
            "loanName": "Thiba"
          },
          {
            "name": "WAMUMU",
            "loanName": "Wamumu"
          }
        ]
      },
      {
        "name": "NDIA",
        "loanName": "Ndia",
        "wards": [
          {
            "name": "KARITI",
            "loanName": "Kariti"
          },
          {
            "name": "KIINE",
            "loanName": "Kiine"
          },
          {
            "name": "MUKURE",
            "loanName": "Mukure"
          }
        ]
      }
    ]
  },
  {
    "code": 21,
    "name": "Murang\\\\a",
    "loanName": "Murang'a",
    "constituencies": [
      {
        "name": "GATANGA",
        "loanName": "Gatanga",
        "wards": [
          {
            "name": "GATANGA",
            "loanName": "Gatanga"
          },
          {
            "name": "ITHANGA",
            "loanName": "Ithanga"
          },
          {
            "name": "KAKUZI/MITUBIRI",
            "loanName": "Kakuzi/mitubiri"
          },
          {
            "name": "KARIARA",
            "loanName": "Kariara"
          },
          {
            "name": "KIHUMBU-INI",
            "loanName": "Kihumbu-ini"
          },
          {
            "name": "MUGUMO-INI",
            "loanName": "Mugumo-ini"
          }
        ]
      },
      {
        "name": "KANDARA",
        "loanName": "Kandara",
        "wards": [
          {
            "name": "GAICHANJIRU",
            "loanName": "Gaichanjiru"
          },
          {
            "name": "ITHIRU",
            "loanName": "Ithiru"
          },
          {
            "name": "KAGUNDU-INI",
            "loanName": "Kagundu-ini"
          },
          {
            "name": "MURUKA",
            "loanName": "Muruka"
          },
          {
            "name": "RUCHU",
            "loanName": "Ruchu"
          }
        ]
      },
      {
        "name": "KANGEMA",
        "loanName": "Kangema",
        "wards": [
          {
            "name": "KANYENYA-INI",
            "loanName": "Kanyenya-ini"
          },
          {
            "name": "MUGURU",
            "loanName": "Muguru"
          },
          {
            "name": "RWATHIA",
            "loanName": "Rwathia"
          }
        ]
      },
      {
        "name": "KIGUMO",
        "loanName": "Kigumo",
        "wards": [
          {
            "name": "KAHUMBU",
            "loanName": "Kahumbu"
          },
          {
            "name": "KANGARI",
            "loanName": "Kangari"
          },
          {
            "name": "KIGUMO",
            "loanName": "Kigumo"
          },
          {
            "name": "KINYONA",
            "loanName": "Kinyona"
          },
          {
            "name": "MUTHITHI",
            "loanName": "Muthithi"
          }
        ]
      },
      {
        "name": "KIHARU",
        "loanName": "Kiharu",
        "wards": [
          {
            "name": "GATURI",
            "loanName": "Gaturi"
          },
          {
            "name": "MBIRI",
            "loanName": "Mbiri"
          },
          {
            "name": "MUGOIRI",
            "loanName": "Mugoiri"
          },
          {
            "name": "MURARANDIA",
            "loanName": "Murarandia"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          },
          {
            "name": "WANGU",
            "loanName": "Wangu"
          }
        ]
      },
      {
        "name": "MARAGWA",
        "loanName": "Maragwa",
        "wards": [
          {
            "name": "ICHAGAKI",
            "loanName": "Ichagaki"
          },
          {
            "name": "KAMAHUHA",
            "loanName": "Kamahuha"
          },
          {
            "name": "KAMBITI",
            "loanName": "Kambiti"
          },
          {
            "name": "KIMORORI/WEMPA",
            "loanName": "Kimorori/wempa"
          },
          {
            "name": "MAKUYU",
            "loanName": "Makuyu"
          },
          {
            "name": "NGINDA",
            "loanName": "Nginda"
          }
        ]
      },
      {
        "name": "MATHIOYA",
        "loanName": "Mathioya",
        "wards": [
          {
            "name": "GITUGI",
            "loanName": "Gitugi"
          },
          {
            "name": "KAMACHARIA",
            "loanName": "Kamacharia"
          },
          {
            "name": "KIRU",
            "loanName": "Kiru"
          }
        ]
      }
    ]
  },
  {
    "code": 22,
    "name": "Kiambu",
    "loanName": "Kiambu",
    "constituencies": [
      {
        "name": "GATUNDU NORTH",
        "loanName": "Gatundu North",
        "wards": [
          {
            "name": "CHANIA",
            "loanName": "Chania"
          },
          {
            "name": "GITHOBOKONI",
            "loanName": "Githobokoni"
          },
          {
            "name": "GITUAMBA",
            "loanName": "Gituamba"
          }
        ]
      },
      {
        "name": "GATUNDU SOUTH",
        "loanName": "Gatundu South",
        "wards": [
          {
            "name": "KIAMWANGI",
            "loanName": "Kiamwangi"
          },
          {
            "name": "KIGANJO",
            "loanName": "Kiganjo"
          },
          {
            "name": "NDARUGU",
            "loanName": "Ndarugu"
          },
          {
            "name": "NGENDA",
            "loanName": "Ngenda"
          }
        ]
      },
      {
        "name": "GITHUNGURI",
        "loanName": "Githunguri",
        "wards": [
          {
            "name": "GITHIGA",
            "loanName": "Githiga"
          },
          {
            "name": "GITHUNGURI",
            "loanName": "Githunguri"
          },
          {
            "name": "IKINU",
            "loanName": "Ikinu"
          },
          {
            "name": "KOMOTHAI",
            "loanName": "Komothai"
          },
          {
            "name": "NGEWA",
            "loanName": "Ngewa"
          }
        ]
      },
      {
        "name": "JUJA",
        "loanName": "Juja",
        "wards": [
          {
            "name": "JUJA",
            "loanName": "Juja"
          },
          {
            "name": "KALIMONI",
            "loanName": "Kalimoni"
          },
          {
            "name": "MURERA",
            "loanName": "Murera"
          },
          {
            "name": "THETA",
            "loanName": "Theta"
          },
          {
            "name": "WITEITHIE",
            "loanName": "Witeithie"
          }
        ]
      },
      {
        "name": "KABETE",
        "loanName": "Kabete",
        "wards": [
          {
            "name": "GITARU",
            "loanName": "Gitaru"
          },
          {
            "name": "KABETE",
            "loanName": "Kabete"
          },
          {
            "name": "MUGUGA",
            "loanName": "Muguga"
          },
          {
            "name": "NYADHUNA",
            "loanName": "Nyadhuna"
          },
          {
            "name": "UTHIRU",
            "loanName": "Uthiru"
          }
        ]
      },
      {
        "name": "KIAMBAA",
        "loanName": "Kiambaa",
        "wards": [
          {
            "name": "CIANDA",
            "loanName": "Cianda"
          },
          {
            "name": "KARURI",
            "loanName": "Karuri"
          },
          {
            "name": "KIHARA",
            "loanName": "Kihara"
          },
          {
            "name": "MUCHATHA",
            "loanName": "Muchatha"
          },
          {
            "name": "NDENDERU",
            "loanName": "Ndenderu"
          }
        ]
      },
      {
        "name": "KIAMBU",
        "loanName": "Kiambu",
        "wards": [
          {
            "name": "NDUMBERI",
            "loanName": "Ndumberi"
          },
          {
            "name": "RIABAI",
            "loanName": "Riabai"
          },
          {
            "name": "TING\\\\ANG\\\\A",
            "loanName": "Ting\\\\ang\\\\a"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          }
        ]
      },
      {
        "name": "KIKUYU",
        "loanName": "Kikuyu",
        "wards": [
          {
            "name": "KARAI",
            "loanName": "Karai"
          },
          {
            "name": "KIKUYU",
            "loanName": "Kikuyu"
          },
          {
            "name": "KINOO",
            "loanName": "Kinoo"
          },
          {
            "name": "NACHU",
            "loanName": "Nachu"
          },
          {
            "name": "SIGONA",
            "loanName": "Sigona"
          }
        ]
      },
      {
        "name": "LARI",
        "loanName": "Lari",
        "wards": [
          {
            "name": "KAMBURU",
            "loanName": "Kamburu"
          },
          {
            "name": "KIJABE",
            "loanName": "Kijabe"
          },
          {
            "name": "KINALE",
            "loanName": "Kinale"
          },
          {
            "name": "LARI/KIRENGA",
            "loanName": "Lari/kirenga"
          },
          {
            "name": "NYANDUMA",
            "loanName": "Nyanduma"
          }
        ]
      },
      {
        "name": "LIMURU",
        "loanName": "Limuru",
        "wards": [
          {
            "name": "BIBIRIONI",
            "loanName": "Bibirioni"
          },
          {
            "name": "LIMURU CENTRAL",
            "loanName": "Limuru Central"
          },
          {
            "name": "LIMURU EAST",
            "loanName": "Limuru East"
          },
          {
            "name": "NDEIYA",
            "loanName": "Ndeiya"
          },
          {
            "name": "NGECHA TIGONI",
            "loanName": "Ngecha Tigoni"
          }
        ]
      },
      {
        "name": "RUIRU",
        "loanName": "Ruiru",
        "wards": [
          {
            "name": "BIASHARA",
            "loanName": "Biashara"
          },
          {
            "name": "GATONGORA",
            "loanName": "Gatongora"
          },
          {
            "name": "GITOTHUA",
            "loanName": "Gitothua"
          },
          {
            "name": "KAHAWA SUKARI",
            "loanName": "Kahawa Sukari"
          },
          {
            "name": "KAHAWA WENDANI",
            "loanName": "Kahawa Wendani"
          },
          {
            "name": "KIUU",
            "loanName": "Kiuu"
          },
          {
            "name": "MWIHOKO",
            "loanName": "Mwihoko"
          },
          {
            "name": "MWIKI",
            "loanName": "Mwiki"
          }
        ]
      },
      {
        "name": "THIKA TOWN",
        "loanName": "Thika Town",
        "wards": [
          {
            "name": "GATUANYAGA",
            "loanName": "Gatuanyaga"
          },
          {
            "name": "HOSPITAL",
            "loanName": "Hospital"
          },
          {
            "name": "KAMENU",
            "loanName": "Kamenu"
          },
          {
            "name": "NGOLIBA",
            "loanName": "Ngoliba"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          }
        ]
      }
    ]
  },
  {
    "code": 23,
    "name": "Turkana",
    "loanName": "Turkana",
    "constituencies": [
      {
        "name": "LOIMA",
        "loanName": "Loima",
        "wards": [
          {
            "name": "KOTARUK/LOBEI",
            "loanName": "Kotaruk/lobei"
          },
          {
            "name": "LOIMA",
            "loanName": "Loima"
          },
          {
            "name": "LOKIRIAMA/LORENGIPPI",
            "loanName": "Lokiriama/lorengippi"
          },
          {
            "name": "TURKWEL",
            "loanName": "Turkwel"
          }
        ]
      },
      {
        "name": "TURKANA CENTRAL",
        "loanName": "Turkana Central",
        "wards": [
          {
            "name": "KALOKOL",
            "loanName": "Kalokol"
          },
          {
            "name": "KANAMKEMER",
            "loanName": "Kanamkemer"
          },
          {
            "name": "KERIO DELTA",
            "loanName": "Kerio Delta"
          },
          {
            "name": "LODWAR TOWNSHIP",
            "loanName": "Lodwar Township"
          }
        ]
      },
      {
        "name": "TURKANA EAST",
        "loanName": "Turkana East",
        "wards": [
          {
            "name": "KAPEDO/NAPEITOM",
            "loanName": "Kapedo/napeitom"
          },
          {
            "name": "KATILIA",
            "loanName": "Katilia"
          },
          {
            "name": "LOKORI/KOCHODIN",
            "loanName": "Lokori/kochodin"
          }
        ]
      },
      {
        "name": "TURKANA NORTH",
        "loanName": "Turkana North",
        "wards": [
          {
            "name": "KAALENG/KAIKOR",
            "loanName": "Kaaleng/kaikor"
          },
          {
            "name": "KAERIS",
            "loanName": "Kaeris"
          },
          {
            "name": "KIBISH",
            "loanName": "Kibish"
          },
          {
            "name": "LAKE ZONE",
            "loanName": "Lake Zone"
          },
          {
            "name": "LAPUR",
            "loanName": "Lapur"
          },
          {
            "name": "NAKALALE",
            "loanName": "Nakalale"
          }
        ]
      },
      {
        "name": "TURKANA SOUTH",
        "loanName": "Turkana South",
        "wards": [
          {
            "name": "KALAPATA",
            "loanName": "Kalapata"
          },
          {
            "name": "KAPUTIR",
            "loanName": "Kaputir"
          },
          {
            "name": "KATILU",
            "loanName": "Katilu"
          },
          {
            "name": "LOBOKAT",
            "loanName": "Lobokat"
          },
          {
            "name": "LOKICHAR",
            "loanName": "Lokichar"
          }
        ]
      },
      {
        "name": "TURKANA WEST",
        "loanName": "Turkana West",
        "wards": [
          {
            "name": "KAKUMA",
            "loanName": "Kakuma"
          },
          {
            "name": "KALOBEYEI",
            "loanName": "Kalobeyei"
          },
          {
            "name": "LETEA",
            "loanName": "Letea"
          },
          {
            "name": "LOKICHOGGIO",
            "loanName": "Lokichoggio"
          },
          {
            "name": "LOPUR",
            "loanName": "Lopur"
          },
          {
            "name": "NANAAM",
            "loanName": "Nanaam"
          },
          {
            "name": "SONGOT",
            "loanName": "Songot"
          }
        ]
      }
    ]
  },
  {
    "code": 24,
    "name": "West Pokot",
    "loanName": "West Pokot",
    "constituencies": [
      {
        "name": "KACHELIBA",
        "loanName": "Kacheliba",
        "wards": [
          {
            "name": "ALALE",
            "loanName": "Alale"
          },
          {
            "name": "KAPCHOK",
            "loanName": "Kapchok"
          },
          {
            "name": "KASEI",
            "loanName": "Kasei"
          },
          {
            "name": "KIWAWA",
            "loanName": "Kiwawa"
          },
          {
            "name": "KODICH",
            "loanName": "Kodich"
          },
          {
            "name": "SUAM",
            "loanName": "Suam"
          }
        ]
      },
      {
        "name": "KAPENGURIA",
        "loanName": "Kapenguria",
        "wards": [
          {
            "name": "ENDUGH",
            "loanName": "Endugh"
          },
          {
            "name": "KAPENGURIA",
            "loanName": "Kapenguria"
          },
          {
            "name": "MNAGEI",
            "loanName": "Mnagei"
          },
          {
            "name": "RIWO",
            "loanName": "Riwo"
          },
          {
            "name": "SIYOI",
            "loanName": "Siyoi"
          },
          {
            "name": "SOOK",
            "loanName": "Sook"
          }
        ]
      },
      {
        "name": "POKOT SOUTH",
        "loanName": "Pokot South",
        "wards": [
          {
            "name": "BATEI",
            "loanName": "Batei"
          },
          {
            "name": "CHEPARERIA",
            "loanName": "Chepareria"
          },
          {
            "name": "LELAN",
            "loanName": "Lelan"
          },
          {
            "name": "TAPACH",
            "loanName": "Tapach"
          }
        ]
      },
      {
        "name": "SIGOR",
        "loanName": "Sigor",
        "wards": [
          {
            "name": "LOMUT",
            "loanName": "Lomut"
          },
          {
            "name": "MASOOL",
            "loanName": "Masool"
          },
          {
            "name": "SEKERR",
            "loanName": "Sekerr"
          },
          {
            "name": "WEIWEI",
            "loanName": "Weiwei"
          }
        ]
      }
    ]
  },
  {
    "code": 25,
    "name": "Samburu",
    "loanName": "Samburu",
    "constituencies": [
      {
        "name": "SAMBURU EAST",
        "loanName": "Samburu East",
        "wards": [
          {
            "name": "WAMBA EAST",
            "loanName": "Wamba East"
          },
          {
            "name": "WAMBA NORTH",
            "loanName": "Wamba North"
          },
          {
            "name": "WAMBA WEST",
            "loanName": "Wamba West"
          },
          {
            "name": "WASO",
            "loanName": "Waso"
          }
        ]
      },
      {
        "name": "SAMBURU NORTH",
        "loanName": "Samburu North",
        "wards": [
          {
            "name": "ANGATA NANYOKIE",
            "loanName": "Angata Nanyokie"
          },
          {
            "name": "BAAWA",
            "loanName": "Baawa"
          },
          {
            "name": "EL-BARTA",
            "loanName": "El-barta"
          },
          {
            "name": "NACHOLA",
            "loanName": "Nachola"
          },
          {
            "name": "NDOTO",
            "loanName": "Ndoto"
          },
          {
            "name": "NYIRO",
            "loanName": "Nyiro"
          }
        ]
      },
      {
        "name": "SAMBURU WEST",
        "loanName": "Samburu West",
        "wards": [
          {
            "name": "LODOKEJEK",
            "loanName": "Lodokejek"
          },
          {
            "name": "LOOSUK",
            "loanName": "Loosuk"
          },
          {
            "name": "MARALAL",
            "loanName": "Maralal"
          },
          {
            "name": "PORO",
            "loanName": "Poro"
          },
          {
            "name": "SUGUTA MARMAR",
            "loanName": "Suguta Marmar"
          }
        ]
      }
    ]
  },
  {
    "code": 26,
    "name": "Trans Nzoia",
    "loanName": "Trans Nzoia",
    "constituencies": [
      {
        "name": "CHERANGANY",
        "loanName": "Cherangany",
        "wards": [
          {
            "name": "CHEPSIRO/KIPTOROR",
            "loanName": "Chepsiro/kiptoror"
          },
          {
            "name": "CHERANGANY/SUWERWA",
            "loanName": "Cherangany/suwerwa"
          },
          {
            "name": "KAPLAMAI",
            "loanName": "Kaplamai"
          },
          {
            "name": "MAKUTANO",
            "loanName": "Makutano"
          },
          {
            "name": "MOTOSIET",
            "loanName": "Motosiet"
          },
          {
            "name": "SINYERERE",
            "loanName": "Sinyerere"
          },
          {
            "name": "SITATUNGA",
            "loanName": "Sitatunga"
          }
        ]
      },
      {
        "name": "ENDEBESS",
        "loanName": "Endebess",
        "wards": [
          {
            "name": "CHEPCHOINA",
            "loanName": "Chepchoina"
          },
          {
            "name": "ENDEBESS",
            "loanName": "Endebess"
          },
          {
            "name": "MATUMBEI",
            "loanName": "Matumbei"
          }
        ]
      },
      {
        "name": "KIMININI",
        "loanName": "Kiminini",
        "wards": [
          {
            "name": "HOSPITAL",
            "loanName": "Hospital"
          },
          {
            "name": "KIMININI",
            "loanName": "Kiminini"
          },
          {
            "name": "NABISWA",
            "loanName": "Nabiswa"
          },
          {
            "name": "SIKHENDU",
            "loanName": "Sikhendu"
          },
          {
            "name": "SIRENDE",
            "loanName": "Sirende"
          },
          {
            "name": "WAITALUK",
            "loanName": "Waitaluk"
          }
        ]
      },
      {
        "name": "KWANZA",
        "loanName": "Kwanza",
        "wards": [
          {
            "name": "BIDII",
            "loanName": "Bidii"
          },
          {
            "name": "KAPOMBOI",
            "loanName": "Kapomboi"
          },
          {
            "name": "KEIYO",
            "loanName": "Keiyo"
          },
          {
            "name": "KWANZA",
            "loanName": "Kwanza"
          }
        ]
      },
      {
        "name": "SABOTI",
        "loanName": "Saboti",
        "wards": [
          {
            "name": "KINYORO",
            "loanName": "Kinyoro"
          },
          {
            "name": "MACHEWA",
            "loanName": "Machewa"
          },
          {
            "name": "MATISI",
            "loanName": "Matisi"
          },
          {
            "name": "SABOTI",
            "loanName": "Saboti"
          },
          {
            "name": "TUWANI",
            "loanName": "Tuwani"
          }
        ]
      }
    ]
  },
  {
    "code": 27,
    "name": "Uasin Gishu",
    "loanName": "Uasin Gishu",
    "constituencies": [
      {
        "name": "AINABKOI",
        "loanName": "Ainabkoi",
        "wards": [
          {
            "name": "AINABKOI/OLARE",
            "loanName": "Ainabkoi/olare"
          },
          {
            "name": "KAPSOYA",
            "loanName": "Kapsoya"
          },
          {
            "name": "KAPTAGAT",
            "loanName": "Kaptagat"
          }
        ]
      },
      {
        "name": "KAPSERET",
        "loanName": "Kapseret",
        "wards": [
          {
            "name": "KIPKENYO",
            "loanName": "Kipkenyo"
          },
          {
            "name": "LANGAS",
            "loanName": "Langas"
          },
          {
            "name": "MEGUN",
            "loanName": "Megun"
          },
          {
            "name": "NGERIA",
            "loanName": "Ngeria"
          },
          {
            "name": "SIMAT/KAPSERET",
            "loanName": "Simat/kapseret"
          }
        ]
      },
      {
        "name": "KESSES",
        "loanName": "Kesses",
        "wards": [
          {
            "name": "CHEPTIRET/KIPCHAMO",
            "loanName": "Cheptiret/kipchamo"
          },
          {
            "name": "RACECOURSE",
            "loanName": "Racecourse"
          },
          {
            "name": "TARAKWA",
            "loanName": "Tarakwa"
          },
          {
            "name": "TULWET/CHUIYAT",
            "loanName": "Tulwet/chuiyat"
          }
        ]
      },
      {
        "name": "MOIBEN",
        "loanName": "Moiben",
        "wards": [
          {
            "name": "KARUNA/MEIBEKI",
            "loanName": "Karuna/meibeki"
          },
          {
            "name": "KIMUMU",
            "loanName": "Kimumu"
          },
          {
            "name": "MOIBEN",
            "loanName": "Moiben"
          },
          {
            "name": "SERGOIT",
            "loanName": "Sergoit"
          },
          {
            "name": "TEMBELIO",
            "loanName": "Tembelio"
          }
        ]
      },
      {
        "name": "SOY",
        "loanName": "Soy",
        "wards": [
          {
            "name": "KAPKURES",
            "loanName": "Kapkures"
          },
          {
            "name": "KIPSOMBA",
            "loanName": "Kipsomba"
          },
          {
            "name": "KUINET/KAPSUSWA",
            "loanName": "Kuinet/kapsuswa"
          },
          {
            "name": "SEGERO/BARSOMBE",
            "loanName": "Segero/barsombe"
          },
          {
            "name": "SOY",
            "loanName": "Soy"
          },
          {
            "name": "ZIWA",
            "loanName": "Ziwa"
          }
        ]
      },
      {
        "name": "TURBO",
        "loanName": "Turbo",
        "wards": [
          {
            "name": "HURUMA",
            "loanName": "Huruma"
          },
          {
            "name": "KAMAGUT",
            "loanName": "Kamagut"
          },
          {
            "name": "KAPSAOS",
            "loanName": "Kapsaos"
          },
          {
            "name": "KIPLOMBE",
            "loanName": "Kiplombe"
          },
          {
            "name": "NGENYILEL",
            "loanName": "Ngenyilel"
          },
          {
            "name": "TAPSAGOI",
            "loanName": "Tapsagoi"
          }
        ]
      }
    ]
  },
  {
    "code": 28,
    "name": "Elgeyo/Marakwet",
    "loanName": "Elgeyo Marakwet",
    "constituencies": [
      {
        "name": "KEIYO NORTH",
        "loanName": "Keiyo North",
        "wards": [
          {
            "name": "EMSOO",
            "loanName": "Emsoo"
          },
          {
            "name": "KAMARINY",
            "loanName": "Kamariny"
          },
          {
            "name": "KAPCHEMUTWA",
            "loanName": "Kapchemutwa"
          },
          {
            "name": "TAMBACH",
            "loanName": "Tambach"
          }
        ]
      },
      {
        "name": "KEIYO SOUTH",
        "loanName": "Keiyo South",
        "wards": [
          {
            "name": "CHEPKORIO",
            "loanName": "Chepkorio"
          },
          {
            "name": "KABIEMIT",
            "loanName": "Kabiemit"
          },
          {
            "name": "KAPTARAKWA",
            "loanName": "Kaptarakwa"
          },
          {
            "name": "METKEI",
            "loanName": "Metkei"
          },
          {
            "name": "SOY NORTH",
            "loanName": "Soy North"
          },
          {
            "name": "SOY SOUTH",
            "loanName": "Soy South"
          }
        ]
      },
      {
        "name": "MARAKWET EAST",
        "loanName": "Marakwet East",
        "wards": [
          {
            "name": "EMBOBUT / EMBULOT",
            "loanName": "Embobut / Embulot"
          },
          {
            "name": "ENDO",
            "loanName": "Endo"
          },
          {
            "name": "KAPYEGO",
            "loanName": "Kapyego"
          },
          {
            "name": "SAMBIRIR",
            "loanName": "Sambirir"
          }
        ]
      },
      {
        "name": "MARAKWET WEST",
        "loanName": "Marakwet West",
        "wards": [
          {
            "name": "ARROR",
            "loanName": "Arror"
          },
          {
            "name": "KAPSOWAR",
            "loanName": "Kapsowar"
          },
          {
            "name": "LELAN",
            "loanName": "Lelan"
          },
          {
            "name": "MOIBEN/KUSERWO",
            "loanName": "Moiben/kuserwo"
          },
          {
            "name": "SENGWER",
            "loanName": "Sengwer"
          }
        ]
      }
    ]
  },
  {
    "code": 29,
    "name": "Nandi",
    "loanName": "Nandi",
    "constituencies": [
      {
        "name": "ALDAI",
        "loanName": "Aldai",
        "wards": [
          {
            "name": "KABWARENG",
            "loanName": "Kabwareng"
          },
          {
            "name": "KAPTUMO-KABOI",
            "loanName": "Kaptumo-kaboi"
          },
          {
            "name": "KEMELOI-MARABA",
            "loanName": "Kemeloi-maraba"
          },
          {
            "name": "KOBUJOI",
            "loanName": "Kobujoi"
          },
          {
            "name": "KOYO-NDURIO",
            "loanName": "Koyo-ndurio"
          },
          {
            "name": "TERIK",
            "loanName": "Terik"
          }
        ]
      },
      {
        "name": "CHESUMEI",
        "loanName": "Chesumei",
        "wards": [
          {
            "name": "KAPTEL/KAMOIYWO",
            "loanName": "Kaptel/kamoiywo"
          },
          {
            "name": "KIPTUYA",
            "loanName": "Kiptuya"
          },
          {
            "name": "KOSIRAI",
            "loanName": "Kosirai"
          },
          {
            "name": "LELMOKWO/NGECHEK",
            "loanName": "Lelmokwo/ngechek"
          }
        ]
      },
      {
        "name": "EMGWEN",
        "loanName": "Emgwen",
        "wards": [
          {
            "name": "CHEPKUMIA",
            "loanName": "Chepkumia"
          },
          {
            "name": "KAPKANGANI",
            "loanName": "Kapkangani"
          },
          {
            "name": "KAPSABET",
            "loanName": "Kapsabet"
          },
          {
            "name": "KILIBWONI",
            "loanName": "Kilibwoni"
          }
        ]
      },
      {
        "name": "MOSOP",
        "loanName": "Mosop",
        "wards": [
          {
            "name": "CHEPTERWAI",
            "loanName": "Chepterwai"
          },
          {
            "name": "KABISAGA",
            "loanName": "Kabisaga"
          },
          {
            "name": "KABIYET",
            "loanName": "Kabiyet"
          },
          {
            "name": "KIPKAREN",
            "loanName": "Kipkaren"
          },
          {
            "name": "KURGUNG/SURUNGAI",
            "loanName": "Kurgung/surungai"
          },
          {
            "name": "NDALAT",
            "loanName": "Ndalat"
          },
          {
            "name": "SANGALO/KEBULONIK",
            "loanName": "Sangalo/kebulonik"
          }
        ]
      },
      {
        "name": "NANDI HILLS",
        "loanName": "Nandi Hills",
        "wards": [
          {
            "name": "CHEPKUNYUK",
            "loanName": "Chepkunyuk"
          },
          {
            "name": "KAPCHORUA",
            "loanName": "Kapchorua"
          },
          {
            "name": "NANDI HILLS",
            "loanName": "Nandi Hills"
          }
        ]
      },
      {
        "name": "TINDERET",
        "loanName": "Tinderet",
        "wards": [
          {
            "name": "CHEMELIL/CHEMASE",
            "loanName": "Chemelil/chemase"
          },
          {
            "name": "KAPSIMOTWO",
            "loanName": "Kapsimotwo"
          },
          {
            "name": "SONGHOR/SOBA",
            "loanName": "Songhor/soba"
          },
          {
            "name": "TINDIRET",
            "loanName": "Tindiret"
          }
        ]
      }
    ]
  },
  {
    "code": 30,
    "name": "Baringo",
    "loanName": "Baringo",
    "constituencies": [
      {
        "name": "BARINGO CENTRAL",
        "loanName": "Baringo Central",
        "wards": [
          {
            "name": "EWALEL/CHAPCHAP",
            "loanName": "Ewalel/chapchap"
          },
          {
            "name": "KABARNET",
            "loanName": "Kabarnet"
          },
          {
            "name": "KAPROPITA",
            "loanName": "Kapropita"
          },
          {
            "name": "SACHO",
            "loanName": "Sacho"
          },
          {
            "name": "TENGES",
            "loanName": "Tenges"
          }
        ]
      },
      {
        "name": "BARINGO NORTH",
        "loanName": "Baringo North",
        "wards": [
          {
            "name": "BARTABWA",
            "loanName": "Bartabwa"
          },
          {
            "name": "BARWESSA",
            "loanName": "Barwessa"
          },
          {
            "name": "KABARTONJO",
            "loanName": "Kabartonjo"
          },
          {
            "name": "SAIMO/KIPSARAMAN",
            "loanName": "Saimo/kipsaraman"
          },
          {
            "name": "SAIMO/SOI",
            "loanName": "Saimo/soi"
          }
        ]
      },
      {
        "name": "BARINGO SOUTH",
        "loanName": "Baringo South",
        "wards": [
          {
            "name": "ILCHAMUS",
            "loanName": "Ilchamus"
          },
          {
            "name": "MARIGAT",
            "loanName": "Marigat"
          },
          {
            "name": "MOCHONGOI",
            "loanName": "Mochongoi"
          },
          {
            "name": "MUKUTANI",
            "loanName": "Mukutani"
          }
        ]
      },
      {
        "name": "ELDAMA RAVINE",
        "loanName": "Eldama Ravine",
        "wards": [
          {
            "name": "KOIBATEK",
            "loanName": "Koibatek"
          },
          {
            "name": "LEMBUS",
            "loanName": "Lembus"
          },
          {
            "name": "LEMBUS KWEN",
            "loanName": "Lembus Kwen"
          },
          {
            "name": "LEMBUS/PERKERRA",
            "loanName": "Lembus/perkerra"
          },
          {
            "name": "MUMBERES/MAJI MAZURI",
            "loanName": "Mumberes/maji Mazuri"
          },
          {
            "name": "RAVINE",
            "loanName": "Ravine"
          }
        ]
      },
      {
        "name": "MOGOTIO",
        "loanName": "Mogotio",
        "wards": [
          {
            "name": "EMINING",
            "loanName": "Emining"
          },
          {
            "name": "KISANANA",
            "loanName": "Kisanana"
          },
          {
            "name": "MOGOTIO",
            "loanName": "Mogotio"
          }
        ]
      },
      {
        "name": "TIATY",
        "loanName": "Tiaty",
        "wards": [
          {
            "name": "CHURO/AMAYA",
            "loanName": "Churo/amaya"
          },
          {
            "name": "KOLOWA",
            "loanName": "Kolowa"
          },
          {
            "name": "LOIYAMOROCK",
            "loanName": "Loiyamorock"
          },
          {
            "name": "RIBKWO",
            "loanName": "Ribkwo"
          },
          {
            "name": "SILALE",
            "loanName": "Silale"
          },
          {
            "name": "TANGULBEI/KOROSSI",
            "loanName": "Tangulbei/korossi"
          },
          {
            "name": "TIRIOKO",
            "loanName": "Tirioko"
          }
        ]
      }
    ]
  },
  {
    "code": 31,
    "name": "Laikipia",
    "loanName": "Laikipia",
    "constituencies": [
      {
        "name": "LAIKIPIA EAST",
        "loanName": "Laikipia East",
        "wards": [
          {
            "name": "NANYUKI",
            "loanName": "Nanyuki"
          },
          {
            "name": "NGOBIT",
            "loanName": "Ngobit"
          },
          {
            "name": "THINGITHU",
            "loanName": "Thingithu"
          },
          {
            "name": "TIGITHI",
            "loanName": "Tigithi"
          },
          {
            "name": "UMANDE",
            "loanName": "Umande"
          }
        ]
      },
      {
        "name": "LAIKIPIA NORTH",
        "loanName": "Laikipia North",
        "wards": [
          {
            "name": "MUGOGODO EAST",
            "loanName": "Mugogodo East"
          },
          {
            "name": "MUGOGODO WEST",
            "loanName": "Mugogodo West"
          },
          {
            "name": "SEGERA",
            "loanName": "Segera"
          },
          {
            "name": "SOSIAN",
            "loanName": "Sosian"
          }
        ]
      },
      {
        "name": "LAIKIPIA WEST",
        "loanName": "Laikipia West",
        "wards": [
          {
            "name": "GITHIGA",
            "loanName": "Githiga"
          },
          {
            "name": "IGWAMITI",
            "loanName": "Igwamiti"
          },
          {
            "name": "MARMANET",
            "loanName": "Marmanet"
          },
          {
            "name": "OL-MORAN",
            "loanName": "Ol-moran"
          },
          {
            "name": "RUMURUTI TOWNSHIP",
            "loanName": "Rumuruti Township"
          },
          {
            "name": "SALAMA",
            "loanName": "Salama"
          }
        ]
      }
    ]
  },
  {
    "code": 32,
    "name": "Nakuru",
    "loanName": "Nakuru",
    "constituencies": [
      {
        "name": "BAHATI",
        "loanName": "Bahati",
        "wards": [
          {
            "name": "BAHATI",
            "loanName": "Bahati"
          },
          {
            "name": "DUNDORI",
            "loanName": "Dundori"
          },
          {
            "name": "KABATINI",
            "loanName": "Kabatini"
          },
          {
            "name": "KIAMAINA",
            "loanName": "Kiamaina"
          },
          {
            "name": "LANET/UMOJA",
            "loanName": "Lanet/umoja"
          }
        ]
      },
      {
        "name": "GILGIL",
        "loanName": "Gilgil",
        "wards": [
          {
            "name": "ELEMENTAITA",
            "loanName": "Elementaita"
          },
          {
            "name": "GILGIL",
            "loanName": "Gilgil"
          },
          {
            "name": "MALEWA WEST",
            "loanName": "Malewa West"
          },
          {
            "name": "MBARUK/EBURU",
            "loanName": "Mbaruk/eburu"
          },
          {
            "name": "MURINDATI",
            "loanName": "Murindati"
          }
        ]
      },
      {
        "name": "KURESOI NORTH",
        "loanName": "Kuresoi North",
        "wards": [
          {
            "name": "KAMARA",
            "loanName": "Kamara"
          },
          {
            "name": "KIPTORORO",
            "loanName": "Kiptororo"
          },
          {
            "name": "NYOTA",
            "loanName": "Nyota"
          },
          {
            "name": "SIRIKWA",
            "loanName": "Sirikwa"
          }
        ]
      },
      {
        "name": "KURESOI SOUTH",
        "loanName": "Kuresoi South",
        "wards": [
          {
            "name": "AMALO",
            "loanName": "Amalo"
          },
          {
            "name": "KERINGET",
            "loanName": "Keringet"
          },
          {
            "name": "KIPTAGICH",
            "loanName": "Kiptagich"
          },
          {
            "name": "TINET",
            "loanName": "Tinet"
          }
        ]
      },
      {
        "name": "MOLO",
        "loanName": "Molo",
        "wards": [
          {
            "name": "ELBURGON",
            "loanName": "Elburgon"
          },
          {
            "name": "MARIASHONI",
            "loanName": "Mariashoni"
          },
          {
            "name": "MOLO",
            "loanName": "Molo"
          },
          {
            "name": "TURI",
            "loanName": "Turi"
          }
        ]
      },
      {
        "name": "NAIVASHA",
        "loanName": "Naivasha",
        "wards": [
          {
            "name": "BIASHARA",
            "loanName": "Biashara"
          },
          {
            "name": "HELLS GATE",
            "loanName": "Hells Gate"
          },
          {
            "name": "LAKE VIEW",
            "loanName": "Lake View"
          },
          {
            "name": "MAI MAHIU",
            "loanName": "Mai Mahiu"
          },
          {
            "name": "MAIELLA",
            "loanName": "Maiella"
          },
          {
            "name": "NAIVASHA EAST",
            "loanName": "Naivasha East"
          },
          {
            "name": "OLKARIA",
            "loanName": "Olkaria"
          },
          {
            "name": "VIWANDANI",
            "loanName": "Viwandani"
          }
        ]
      },
      {
        "name": "NAKURU TOWN EAST",
        "loanName": "Nakuru Town East",
        "wards": [
          {
            "name": "BIASHARA",
            "loanName": "Biashara"
          },
          {
            "name": "FLAMINGO",
            "loanName": "Flamingo"
          },
          {
            "name": "KIVUMBINI",
            "loanName": "Kivumbini"
          },
          {
            "name": "MENENGAI",
            "loanName": "Menengai"
          },
          {
            "name": "NAKURU EAST",
            "loanName": "Nakuru East"
          }
        ]
      },
      {
        "name": "NAKURU TOWN WEST",
        "loanName": "Nakuru Town West",
        "wards": [
          {
            "name": "BARUT",
            "loanName": "Barut"
          },
          {
            "name": "KAPKURES",
            "loanName": "Kapkures"
          },
          {
            "name": "KAPTEMBWO",
            "loanName": "Kaptembwo"
          },
          {
            "name": "LONDON",
            "loanName": "London"
          },
          {
            "name": "RHODA",
            "loanName": "Rhoda"
          },
          {
            "name": "SHAABAB",
            "loanName": "Shaabab"
          }
        ]
      },
      {
        "name": "NJORO",
        "loanName": "Njoro",
        "wards": [
          {
            "name": "KIHINGO",
            "loanName": "Kihingo"
          },
          {
            "name": "LARE",
            "loanName": "Lare"
          },
          {
            "name": "MAU NAROK",
            "loanName": "Mau Narok"
          },
          {
            "name": "MAUCHE",
            "loanName": "Mauche"
          },
          {
            "name": "NESSUIT",
            "loanName": "Nessuit"
          },
          {
            "name": "NJORO",
            "loanName": "Njoro"
          }
        ]
      },
      {
        "name": "RONGAI",
        "loanName": "Rongai",
        "wards": [
          {
            "name": "MENENGAI WEST",
            "loanName": "Menengai West"
          },
          {
            "name": "MOSOP",
            "loanName": "Mosop"
          },
          {
            "name": "SOIN",
            "loanName": "Soin"
          },
          {
            "name": "SOLAI",
            "loanName": "Solai"
          },
          {
            "name": "VISOI",
            "loanName": "Visoi"
          }
        ]
      },
      {
        "name": "SUBUKIA",
        "loanName": "Subukia",
        "wards": [
          {
            "name": "KABAZI",
            "loanName": "Kabazi"
          },
          {
            "name": "SUBUKIA",
            "loanName": "Subukia"
          },
          {
            "name": "WASEGES",
            "loanName": "Waseges"
          }
        ]
      }
    ]
  },
  {
    "code": 33,
    "name": "Narok",
    "loanName": "Narok",
    "constituencies": [
      {
        "name": "EMURUA DIKIRR",
        "loanName": "Emurua Dikirr",
        "wards": [
          {
            "name": "ILKERIN",
            "loanName": "Ilkerin"
          },
          {
            "name": "KAPSASIAN",
            "loanName": "Kapsasian"
          },
          {
            "name": "MOGONDO",
            "loanName": "Mogondo"
          },
          {
            "name": "OLOlMASANI",
            "loanName": "Ololmasani"
          }
        ]
      },
      {
        "name": "KILGORIS",
        "loanName": "Kilgoris",
        "wards": [
          {
            "name": "ANGATA BARIKOI",
            "loanName": "Angata Barikoi"
          },
          {
            "name": "KEYIAN",
            "loanName": "Keyian"
          },
          {
            "name": "KILGORIS CENTRAL",
            "loanName": "Kilgoris Central"
          },
          {
            "name": "KIMINTET",
            "loanName": "Kimintet"
          },
          {
            "name": "LOLGORIAN",
            "loanName": "Lolgorian"
          },
          {
            "name": "SHANKOE",
            "loanName": "Shankoe"
          }
        ]
      },
      {
        "name": "NAROK EAST",
        "loanName": "Narok East",
        "wards": [
          {
            "name": "ILDAMAT",
            "loanName": "Ildamat"
          },
          {
            "name": "KEEKONYOKIE",
            "loanName": "Keekonyokie"
          },
          {
            "name": "MOSIRO",
            "loanName": "Mosiro"
          },
          {
            "name": "SUSWA",
            "loanName": "Suswa"
          }
        ]
      },
      {
        "name": "NAROK NORTH",
        "loanName": "Narok North",
        "wards": [
          {
            "name": "MELILI",
            "loanName": "Melili"
          },
          {
            "name": "NAROK TOWN",
            "loanName": "Narok Town"
          },
          {
            "name": "NKARETA",
            "loanName": "Nkareta"
          },
          {
            "name": "OLOKURTO",
            "loanName": "Olokurto"
          },
          {
            "name": "OLORROPIL",
            "loanName": "Olorropil"
          },
          {
            "name": "OLPUSIMORU",
            "loanName": "Olpusimoru"
          }
        ]
      },
      {
        "name": "NAROK SOUTH",
        "loanName": "Narok South",
        "wards": [
          {
            "name": "LOITA",
            "loanName": "Loita"
          },
          {
            "name": "MAJIMOTO/NAROOSURA",
            "loanName": "Majimoto/naroosura"
          },
          {
            "name": "MELELO",
            "loanName": "Melelo"
          },
          {
            "name": "SAGAMIAN",
            "loanName": "Sagamian"
          },
          {
            "name": "SOGOO",
            "loanName": "Sogoo"
          }
        ]
      },
      {
        "name": "NAROK WEST",
        "loanName": "Narok West",
        "wards": [
          {
            "name": "ILMOTIOK",
            "loanName": "Ilmotiok"
          },
          {
            "name": "MARA",
            "loanName": "Mara"
          },
          {
            "name": "NAIKARRA",
            "loanName": "Naikarra"
          },
          {
            "name": "SIANA",
            "loanName": "Siana"
          }
        ]
      }
    ]
  },
  {
    "code": 34,
    "name": "Kajiado",
    "loanName": "Kajiado",
    "constituencies": [
      {
        "name": "KAJIADO CENTRAL",
        "loanName": "Kajiado Central",
        "wards": [
          {
            "name": "DALALEKUTUK",
            "loanName": "Dalalekutuk"
          },
          {
            "name": "ILDAMAT",
            "loanName": "Ildamat"
          },
          {
            "name": "MATAPATO NORTH",
            "loanName": "Matapato North"
          },
          {
            "name": "MATAPATO SOUTH",
            "loanName": "Matapato South"
          },
          {
            "name": "PURKO",
            "loanName": "Purko"
          }
        ]
      },
      {
        "name": "KAJIADO EAST",
        "loanName": "Kajiado East",
        "wards": [
          {
            "name": "IMARORO",
            "loanName": "Imaroro"
          },
          {
            "name": "KAPUTIEI NORTH",
            "loanName": "Kaputiei North"
          },
          {
            "name": "KENYAWA-POKA",
            "loanName": "Kenyawa-poka"
          },
          {
            "name": "KITENGELA",
            "loanName": "Kitengela"
          },
          {
            "name": "OLOOSIRKON/SHOLINKE",
            "loanName": "Oloosirkon/sholinke"
          }
        ]
      },
      {
        "name": "KAJIADO NORTH",
        "loanName": "Kajiado North",
        "wards": [
          {
            "name": "NGONG",
            "loanName": "Ngong"
          },
          {
            "name": "NKAIMURUNYA",
            "loanName": "Nkaimurunya"
          },
          {
            "name": "OLKERI",
            "loanName": "Olkeri"
          },
          {
            "name": "OLOOLUA",
            "loanName": "Oloolua"
          },
          {
            "name": "ONGATA RONGAI",
            "loanName": "Ongata Rongai"
          }
        ]
      },
      {
        "name": "KAJIADO SOUTH",
        "loanName": "Kajiado South",
        "wards": [
          {
            "name": "ENTONET/LENKISIM",
            "loanName": "Entonet/lenkisim"
          },
          {
            "name": "KIMANA",
            "loanName": "Kimana"
          },
          {
            "name": "KUKU",
            "loanName": "Kuku"
          },
          {
            "name": "MBIRIKANI/ESELENKEI",
            "loanName": "Mbirikani/eselenkei"
          },
          {
            "name": "ROMBO",
            "loanName": "Rombo"
          }
        ]
      },
      {
        "name": "KAJIADO WEST",
        "loanName": "Kajiado West",
        "wards": [
          {
            "name": "ILOODOKILANI",
            "loanName": "Iloodokilani"
          },
          {
            "name": "KEEKONYOKIE",
            "loanName": "Keekonyokie"
          },
          {
            "name": "MAGADI",
            "loanName": "Magadi"
          },
          {
            "name": "MOSIRO",
            "loanName": "Mosiro"
          }
        ]
      }
    ]
  },
  {
    "code": 35,
    "name": "Kericho",
    "loanName": "Kericho",
    "constituencies": [
      {
        "name": "AINAMOI",
        "loanName": "Ainamoi",
        "wards": [
          {
            "name": "AINAMOI",
            "loanName": "Ainamoi"
          },
          {
            "name": "KAPKUGERWET",
            "loanName": "Kapkugerwet"
          },
          {
            "name": "KAPSAOS",
            "loanName": "Kapsaos"
          },
          {
            "name": "KAPSOIT",
            "loanName": "Kapsoit"
          },
          {
            "name": "KIPCHEBOR",
            "loanName": "Kipchebor"
          },
          {
            "name": "KIPCHIMCHIM",
            "loanName": "Kipchimchim"
          }
        ]
      },
      {
        "name": "BELGUT",
        "loanName": "Belgut",
        "wards": [
          {
            "name": "CHAIK",
            "loanName": "Chaik"
          },
          {
            "name": "CHEPTORORIET/SERETUT",
            "loanName": "Cheptororiet/seretut"
          },
          {
            "name": "KABIANGA",
            "loanName": "Kabianga"
          },
          {
            "name": "KAPSUSER",
            "loanName": "Kapsuser"
          },
          {
            "name": "WALDAI",
            "loanName": "Waldai"
          }
        ]
      },
      {
        "name": "BURETI",
        "loanName": "Bureti",
        "wards": [
          {
            "name": "CHEBOIN",
            "loanName": "Cheboin"
          },
          {
            "name": "CHEMOSOT",
            "loanName": "Chemosot"
          },
          {
            "name": "CHEPLANGET",
            "loanName": "Cheplanget"
          },
          {
            "name": "KAPKATET",
            "loanName": "Kapkatet"
          },
          {
            "name": "KISIARA",
            "loanName": "Kisiara"
          },
          {
            "name": "LITEIN",
            "loanName": "Litein"
          },
          {
            "name": "TEBESONIK",
            "loanName": "Tebesonik"
          }
        ]
      },
      {
        "name": "KIPKELION EAST",
        "loanName": "Kipkelion East",
        "wards": [
          {
            "name": "CHEPSEON",
            "loanName": "Chepseon"
          },
          {
            "name": "KEDOWA/KIMUGUL",
            "loanName": "Kedowa/kimugul"
          },
          {
            "name": "LONDIANI",
            "loanName": "Londiani"
          },
          {
            "name": "TENDENO/SORGET",
            "loanName": "Tendeno/sorget"
          }
        ]
      },
      {
        "name": "KIPKELION WEST",
        "loanName": "Kipkelion West",
        "wards": [
          {
            "name": "CHILCHILA",
            "loanName": "Chilchila"
          },
          {
            "name": "KAMASIAN",
            "loanName": "Kamasian"
          },
          {
            "name": "KIPKELION",
            "loanName": "Kipkelion"
          },
          {
            "name": "KUNYAK",
            "loanName": "Kunyak"
          }
        ]
      },
      {
        "name": "SIGOWET/SOIN",
        "loanName": "Sigowet/Soin",
        "wards": [
          {
            "name": "KAPLELARTET",
            "loanName": "Kaplelartet"
          },
          {
            "name": "SIGOWET",
            "loanName": "Sigowet"
          },
          {
            "name": "SOIN",
            "loanName": "Soin"
          },
          {
            "name": "SOLIAT",
            "loanName": "Soliat"
          }
        ]
      }
    ]
  },
  {
    "code": 36,
    "name": "Bomet",
    "loanName": "Bomet",
    "constituencies": [
      {
        "name": "BOMET CENTRAL",
        "loanName": "Bomet Central",
        "wards": [
          {
            "name": "CHESOEN",
            "loanName": "Chesoen"
          },
          {
            "name": "MUTARAKWA",
            "loanName": "Mutarakwa"
          },
          {
            "name": "NDARAWETA",
            "loanName": "Ndaraweta"
          },
          {
            "name": "SILIBWET TOWNSHIP",
            "loanName": "Silibwet Township"
          },
          {
            "name": "SINGORWET",
            "loanName": "Singorwet"
          }
        ]
      },
      {
        "name": "BOMET EAST",
        "loanName": "Bomet East",
        "wards": [
          {
            "name": "CHEMANER",
            "loanName": "Chemaner"
          },
          {
            "name": "KEMBU",
            "loanName": "Kembu"
          },
          {
            "name": "KIPRERES",
            "loanName": "Kipreres"
          },
          {
            "name": "LONGISA",
            "loanName": "Longisa"
          },
          {
            "name": "MERIGI",
            "loanName": "Merigi"
          }
        ]
      },
      {
        "name": "CHEPALUNGU",
        "loanName": "Chepalungu",
        "wards": [
          {
            "name": "CHEBUNYO",
            "loanName": "Chebunyo"
          },
          {
            "name": "NYANGORES",
            "loanName": "Nyangores"
          },
          {
            "name": "SIGOR",
            "loanName": "Sigor"
          },
          {
            "name": "SIONGIROI",
            "loanName": "Siongiroi"
          }
        ]
      },
      {
        "name": "KONOIN",
        "loanName": "Konoin",
        "wards": [
          {
            "name": "BOITO",
            "loanName": "Boito"
          },
          {
            "name": "CHEPCHABAS",
            "loanName": "Chepchabas"
          },
          {
            "name": "EMBOMOS",
            "loanName": "Embomos"
          },
          {
            "name": "KIMULOT",
            "loanName": "Kimulot"
          },
          {
            "name": "MOGOGOSIEK",
            "loanName": "Mogogosiek"
          }
        ]
      },
      {
        "name": "SOTIK",
        "loanName": "Sotik",
        "wards": [
          {
            "name": "CHEMAGEL",
            "loanName": "Chemagel"
          },
          {
            "name": "KAPLETUNDO",
            "loanName": "Kapletundo"
          },
          {
            "name": "KIPSONOI",
            "loanName": "Kipsonoi"
          },
          {
            "name": "NDANAI/ABOSI",
            "loanName": "Ndanai/abosi"
          },
          {
            "name": "RONGENA/MANARET",
            "loanName": "Rongena/manaret"
          }
        ]
      }
    ]
  },
  {
    "code": 37,
    "name": "Kakamega",
    "loanName": "Kakamega",
    "constituencies": [
      {
        "name": "BUTERE",
        "loanName": "Butere",
        "wards": [
          {
            "name": "MARAMA CENTRAL",
            "loanName": "Marama Central"
          },
          {
            "name": "MARAMA NORTH",
            "loanName": "Marama North"
          },
          {
            "name": "MARAMA SOUTH",
            "loanName": "Marama South"
          },
          {
            "name": "MARAMA WEST",
            "loanName": "Marama West"
          },
          {
            "name": "MARENYO - SHIANDA",
            "loanName": "Marenyo - Shianda"
          }
        ]
      },
      {
        "name": "IKOLOMANI",
        "loanName": "Ikolomani",
        "wards": [
          {
            "name": "IDAKHO CENTRAL",
            "loanName": "Idakho Central"
          },
          {
            "name": "IDAKHO EAST",
            "loanName": "Idakho East"
          },
          {
            "name": "IDAKHO NORTH",
            "loanName": "Idakho North"
          },
          {
            "name": "IDAKHO SOUTH",
            "loanName": "Idakho South"
          }
        ]
      },
      {
        "name": "KHWISERO",
        "loanName": "Khwisero",
        "wards": [
          {
            "name": "KISA CENTRAL",
            "loanName": "Kisa Central"
          },
          {
            "name": "KISA EAST",
            "loanName": "Kisa East"
          },
          {
            "name": "KISA NORTH",
            "loanName": "Kisa North"
          },
          {
            "name": "KISA WEST",
            "loanName": "Kisa West"
          }
        ]
      },
      {
        "name": "LIKUYANI",
        "loanName": "Likuyani",
        "wards": [
          {
            "name": "KONGONI",
            "loanName": "Kongoni"
          },
          {
            "name": "LIKUYANI",
            "loanName": "Likuyani"
          },
          {
            "name": "NZOIA",
            "loanName": "Nzoia"
          },
          {
            "name": "SANGO",
            "loanName": "Sango"
          },
          {
            "name": "SINOKO",
            "loanName": "Sinoko"
          }
        ]
      },
      {
        "name": "LUGARI",
        "loanName": "Lugari",
        "wards": [
          {
            "name": "CHEKALINI",
            "loanName": "Chekalini"
          },
          {
            "name": "CHEVAYWA",
            "loanName": "Chevaywa"
          },
          {
            "name": "LUGARI",
            "loanName": "Lugari"
          },
          {
            "name": "LUMAKANDA",
            "loanName": "Lumakanda"
          },
          {
            "name": "LWANDETI",
            "loanName": "Lwandeti"
          },
          {
            "name": "MAUTUMA",
            "loanName": "Mautuma"
          }
        ]
      },
      {
        "name": "LURAMBI",
        "loanName": "Lurambi",
        "wards": [
          {
            "name": "BUTSOTSO CENTRAL",
            "loanName": "Butsotso Central"
          },
          {
            "name": "BUTSOTSO EAST",
            "loanName": "Butsotso East"
          },
          {
            "name": "BUTSOTSO SOUTH",
            "loanName": "Butsotso South"
          },
          {
            "name": "MAHIAKALO",
            "loanName": "Mahiakalo"
          },
          {
            "name": "SHEYWE",
            "loanName": "Sheywe"
          },
          {
            "name": "SHIRERE",
            "loanName": "Shirere"
          }
        ]
      },
      {
        "name": "MALAVA",
        "loanName": "Malava",
        "wards": [
          {
            "name": "BUTALI/CHEGULO",
            "loanName": "Butali/chegulo"
          },
          {
            "name": "CHEMUCHE",
            "loanName": "Chemuche"
          },
          {
            "name": "EAST KABRAS",
            "loanName": "East Kabras"
          },
          {
            "name": "MANDA-SHIVANGA",
            "loanName": "Manda-shivanga"
          },
          {
            "name": "SHIRUGU-MUGAI",
            "loanName": "Shirugu-mugai"
          },
          {
            "name": "SOUTH KABRAS",
            "loanName": "South Kabras"
          },
          {
            "name": "WEST KABRAS",
            "loanName": "West Kabras"
          }
        ]
      },
      {
        "name": "MATUNGU",
        "loanName": "Matungu",
        "wards": [
          {
            "name": "KHALABA",
            "loanName": "Khalaba"
          },
          {
            "name": "KHOLERA",
            "loanName": "Kholera"
          },
          {
            "name": "KOYONZO",
            "loanName": "Koyonzo"
          },
          {
            "name": "MAYONI",
            "loanName": "Mayoni"
          },
          {
            "name": "NAMAMALI",
            "loanName": "Namamali"
          }
        ]
      },
      {
        "name": "MUMIAS EAST",
        "loanName": "Mumias East",
        "wards": [
          {
            "name": "EAST WANGA",
            "loanName": "East Wanga"
          },
          {
            "name": "LUSHEYA/LUBINU",
            "loanName": "Lusheya/lubinu"
          },
          {
            "name": "MALAHA/ISONGO/MAKUNGA",
            "loanName": "Malaha/isongo/makunga"
          }
        ]
      },
      {
        "name": "MUMIAS WEST",
        "loanName": "Mumias West",
        "wards": [
          {
            "name": "ETENJE",
            "loanName": "Etenje"
          },
          {
            "name": "MUMIAS CENTRAL",
            "loanName": "Mumias Central"
          },
          {
            "name": "MUMIAS NORTH",
            "loanName": "Mumias North"
          },
          {
            "name": "MUSANDA",
            "loanName": "Musanda"
          }
        ]
      },
      {
        "name": "NAVAKHOLO",
        "loanName": "Navakholo",
        "wards": [
          {
            "name": "BUNYALA CENTRAL",
            "loanName": "Bunyala Central"
          },
          {
            "name": "BUNYALA EAST",
            "loanName": "Bunyala East"
          },
          {
            "name": "BUNYALA WEST",
            "loanName": "Bunyala West"
          },
          {
            "name": "INGOSTSE-MATHIA",
            "loanName": "Ingostse-mathia"
          },
          {
            "name": "SHINOYI-SHIKOMARI-ESUMEYIA",
            "loanName": "Shinoyi-shikomari-esumeyia"
          }
        ]
      },
      {
        "name": "SHINYALU",
        "loanName": "Shinyalu",
        "wards": [
          {
            "name": "ISUKHA CENTRAL",
            "loanName": "Isukha Central"
          },
          {
            "name": "ISUKHA EAST",
            "loanName": "Isukha East"
          },
          {
            "name": "ISUKHA NORTH",
            "loanName": "Isukha North"
          },
          {
            "name": "ISUKHA SOUTH",
            "loanName": "Isukha South"
          },
          {
            "name": "ISUKHA WEST",
            "loanName": "Isukha West"
          },
          {
            "name": "MURHANDA",
            "loanName": "Murhanda"
          }
        ]
      }
    ]
  },
  {
    "code": 38,
    "name": "Vihiga",
    "loanName": "Vihiga",
    "constituencies": [
      {
        "name": "EMUHAYA",
        "loanName": "Emuhaya",
        "wards": [
          {
            "name": "CENTRAL BUNYORE",
            "loanName": "Central Bunyore"
          },
          {
            "name": "NORTH EAST BUNYORE",
            "loanName": "North East Bunyore"
          },
          {
            "name": "WEST BUNYORE",
            "loanName": "West Bunyore"
          }
        ]
      },
      {
        "name": "HAMISI",
        "loanName": "Hamisi",
        "wards": [
          {
            "name": "BANJA",
            "loanName": "Banja"
          },
          {
            "name": "GISAMBAI",
            "loanName": "Gisambai"
          },
          {
            "name": "JEPKOYAI",
            "loanName": "Jepkoyai"
          },
          {
            "name": "MUHUDU",
            "loanName": "Muhudu"
          },
          {
            "name": "SHAMAKHOKHO",
            "loanName": "Shamakhokho"
          },
          {
            "name": "SHIRU",
            "loanName": "Shiru"
          },
          {
            "name": "TAMBUA",
            "loanName": "Tambua"
          }
        ]
      },
      {
        "name": "LUANDA",
        "loanName": "Luanda",
        "wards": [
          {
            "name": "EMABUNGO",
            "loanName": "Emabungo"
          },
          {
            "name": "LUANDA SOUTH",
            "loanName": "Luanda South"
          },
          {
            "name": "LUANDA TOWNSHIP",
            "loanName": "Luanda Township"
          },
          {
            "name": "MWIBONA",
            "loanName": "Mwibona"
          },
          {
            "name": "WEMILABI",
            "loanName": "Wemilabi"
          }
        ]
      },
      {
        "name": "SABATIA",
        "loanName": "Sabatia",
        "wards": [
          {
            "name": "BUSALI",
            "loanName": "Busali"
          },
          {
            "name": "CHAVAKALI",
            "loanName": "Chavakali"
          },
          {
            "name": "LYADUYWA/IZAVA",
            "loanName": "Lyaduywa/izava"
          },
          {
            "name": "NORTH MARAGOLI",
            "loanName": "North Maragoli"
          },
          {
            "name": "WEST SABATIA",
            "loanName": "West Sabatia"
          },
          {
            "name": "WODANGA",
            "loanName": "Wodanga"
          }
        ]
      },
      {
        "name": "VIHIGA",
        "loanName": "Vihiga",
        "wards": [
          {
            "name": "CENTRAL MARAGOLI",
            "loanName": "Central Maragoli"
          },
          {
            "name": "LUGAGA-WAMULUMA",
            "loanName": "Lugaga-wamuluma"
          },
          {
            "name": "MUNGOMA",
            "loanName": "Mungoma"
          },
          {
            "name": "SOUTH MARAGOLI",
            "loanName": "South Maragoli"
          }
        ]
      }
    ]
  },
  {
    "code": 39,
    "name": "Bungoma",
    "loanName": "Bungoma",
    "constituencies": [
      {
        "name": "BUMULA",
        "loanName": "Bumula",
        "wards": [
          {
            "name": "BUMULA",
            "loanName": "Bumula"
          },
          {
            "name": "KABULA",
            "loanName": "Kabula"
          },
          {
            "name": "KHASOKO",
            "loanName": "Khasoko"
          },
          {
            "name": "KIMAETI",
            "loanName": "Kimaeti"
          },
          {
            "name": "SIBOTI",
            "loanName": "Siboti"
          },
          {
            "name": "SOUTH BUKUSU",
            "loanName": "South Bukusu"
          },
          {
            "name": "WEST BUKUSU",
            "loanName": "West Bukusu"
          }
        ]
      },
      {
        "name": "KABUCHAI",
        "loanName": "Kabuchai",
        "wards": [
          {
            "name": "BWAKE/LUUYA",
            "loanName": "Bwake/luuya"
          },
          {
            "name": "KABUCHAI/CHWELE",
            "loanName": "Kabuchai/chwele"
          },
          {
            "name": "MUKUYUNI",
            "loanName": "Mukuyuni"
          },
          {
            "name": "WEST NALONDO",
            "loanName": "West Nalondo"
          }
        ]
      },
      {
        "name": "KANDUYI",
        "loanName": "Kanduyi",
        "wards": [
          {
            "name": "BUKEMBE EAST",
            "loanName": "Bukembe East"
          },
          {
            "name": "BUKEMBE WEST",
            "loanName": "Bukembe West"
          },
          {
            "name": "KHALABA",
            "loanName": "Khalaba"
          },
          {
            "name": "MARAKARU/TUUTI",
            "loanName": "Marakaru/tuuti"
          },
          {
            "name": "MUSIKOMA",
            "loanName": "Musikoma"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          }
        ]
      },
      {
        "name": "KIMILILI",
        "loanName": "Kimilili",
        "wards": [
          {
            "name": "KAMUKUYWA",
            "loanName": "Kamukuywa"
          },
          {
            "name": "KIBINGEI",
            "loanName": "Kibingei"
          },
          {
            "name": "KIMILILI",
            "loanName": "Kimilili"
          },
          {
            "name": "MAENI",
            "loanName": "Maeni"
          }
        ]
      },
      {
        "name": "MT. ELGON",
        "loanName": "Mount Elgon",
        "wards": [
          {
            "name": "CHEPTAIS",
            "loanName": "Cheptais"
          },
          {
            "name": "CHEPYUK",
            "loanName": "Chepyuk"
          },
          {
            "name": "CHESIKAKI",
            "loanName": "Chesikaki"
          },
          {
            "name": "ELGON",
            "loanName": "Elgon"
          },
          {
            "name": "KAPKATENY",
            "loanName": "Kapkateny"
          },
          {
            "name": "KAPTAMA",
            "loanName": "Kaptama"
          }
        ]
      },
      {
        "name": "SIRISIA",
        "loanName": "Sirisia",
        "wards": [
          {
            "name": "LWANDANYI",
            "loanName": "Lwandanyi"
          },
          {
            "name": "MALAKISI/SOUTH KULISIRU",
            "loanName": "Malakisi/south Kulisiru"
          },
          {
            "name": "NAMWELA",
            "loanName": "Namwela"
          }
        ]
      },
      {
        "name": "TONGAREN",
        "loanName": "Tongaren",
        "wards": [
          {
            "name": "MBAKALO",
            "loanName": "Mbakalo"
          },
          {
            "name": "MILIMA",
            "loanName": "Milima"
          },
          {
            "name": "NAITIRI/KABUYEFWE",
            "loanName": "Naitiri/kabuyefwe"
          },
          {
            "name": "NDALU/ TABANI",
            "loanName": "Ndalu/ Tabani"
          },
          {
            "name": "SOYSAMBU/ MITUA",
            "loanName": "Soysambu/ Mitua"
          },
          {
            "name": "TONGAREN",
            "loanName": "Tongaren"
          }
        ]
      },
      {
        "name": "WEBUYE EAST",
        "loanName": "Webuye East",
        "wards": [
          {
            "name": "MARAKA",
            "loanName": "Maraka"
          },
          {
            "name": "MIHUU",
            "loanName": "Mihuu"
          },
          {
            "name": "NDIVISI",
            "loanName": "Ndivisi"
          }
        ]
      },
      {
        "name": "WEBUYE WEST",
        "loanName": "Webuye West",
        "wards": [
          {
            "name": "BOKOLI",
            "loanName": "Bokoli"
          },
          {
            "name": "MATULO",
            "loanName": "Matulo"
          },
          {
            "name": "MISIKHU",
            "loanName": "Misikhu"
          },
          {
            "name": "SITIKHO",
            "loanName": "Sitikho"
          }
        ]
      }
    ]
  },
  {
    "code": 40,
    "name": "Busia",
    "loanName": "Busia",
    "constituencies": [
      {
        "name": "BUDALANGI",
        "loanName": "Budalangi",
        "wards": [
          {
            "name": "BUNYALA CENTRAL",
            "loanName": "Bunyala Central"
          },
          {
            "name": "BUNYALA NORTH",
            "loanName": "Bunyala North"
          },
          {
            "name": "BUNYALA SOUTH",
            "loanName": "Bunyala South"
          },
          {
            "name": "BUNYALA WEST",
            "loanName": "Bunyala West"
          }
        ]
      },
      {
        "name": "BUTULA",
        "loanName": "Butula",
        "wards": [
          {
            "name": "ELUGULU",
            "loanName": "Elugulu"
          },
          {
            "name": "KINGANDOLE",
            "loanName": "Kingandole"
          },
          {
            "name": "MARACHI CENTRAL",
            "loanName": "Marachi Central"
          },
          {
            "name": "MARACHI EAST",
            "loanName": "Marachi East"
          },
          {
            "name": "MARACHI NORTH",
            "loanName": "Marachi North"
          },
          {
            "name": "MARACHI WEST",
            "loanName": "Marachi West"
          }
        ]
      },
      {
        "name": "FUNYULA",
        "loanName": "Funyula",
        "wards": [
          {
            "name": "BWIRI",
            "loanName": "Bwiri"
          },
          {
            "name": "NAMBOBOTO NAMBUKU",
            "loanName": "Namboboto Nambuku"
          },
          {
            "name": "NANGINA",
            "loanName": "Nangina"
          }
        ]
      },
      {
        "name": "MATAYOS",
        "loanName": "Matayos",
        "wards": [
          {
            "name": "BUKHAYO WEST",
            "loanName": "Bukhayo West"
          },
          {
            "name": "BURUMBA",
            "loanName": "Burumba"
          },
          {
            "name": "BUSIBWABO",
            "loanName": "Busibwabo"
          },
          {
            "name": "MATAYOS SOUTH",
            "loanName": "Matayos South"
          },
          {
            "name": "MAYENJE",
            "loanName": "Mayenje"
          }
        ]
      },
      {
        "name": "NAMBALE",
        "loanName": "Nambale",
        "wards": [
          {
            "name": "BUKHAYO CENTRAL",
            "loanName": "Bukhayo Central"
          },
          {
            "name": "BUKHAYO EAST",
            "loanName": "Bukhayo East"
          },
          {
            "name": "BUKHAYO NORTH/WALTSI",
            "loanName": "Bukhayo North/waltsi"
          },
          {
            "name": "NAMBALE TOWNSHIP",
            "loanName": "Nambale Township"
          }
        ]
      },
      {
        "name": "TESO NORTH",
        "loanName": "Teso North",
        "wards": [
          {
            "name": "MALABA CENTRAL",
            "loanName": "Malaba Central"
          },
          {
            "name": "MALABA NORTH",
            "loanName": "Malaba North"
          },
          {
            "name": "MALABA SOUTH",
            "loanName": "Malaba South"
          }
        ]
      },
      {
        "name": "TESO SOUTH",
        "loanName": "Teso South",
        "wards": [
          {
            "name": "AMUKURA CENTRAL",
            "loanName": "Amukura Central"
          },
          {
            "name": "AMUKURA EAST",
            "loanName": "Amukura East"
          },
          {
            "name": "AMUKURA WEST",
            "loanName": "Amukura West"
          },
          {
            "name": "CHAKOL NORTH",
            "loanName": "Chakol North"
          },
          {
            "name": "CHAKOL SOUTH",
            "loanName": "Chakol South"
          }
        ]
      }
    ]
  },
  {
    "code": 41,
    "name": "Siaya",
    "loanName": "Siaya",
    "constituencies": [
      {
        "name": "ALEGO USONGA",
        "loanName": "Alego Usonga",
        "wards": [
          {
            "name": "CENTRAL ALEGO",
            "loanName": "Central Alego"
          },
          {
            "name": "NORTH ALEGO",
            "loanName": "North Alego"
          },
          {
            "name": "SIAYA TOWNSHIP",
            "loanName": "Siaya Township"
          },
          {
            "name": "SOUTH EAST ALEGO",
            "loanName": "South East Alego"
          },
          {
            "name": "USONGA",
            "loanName": "Usonga"
          },
          {
            "name": "WEST ALEGO",
            "loanName": "West Alego"
          }
        ]
      },
      {
        "name": "BONDO",
        "loanName": "Bondo",
        "wards": [
          {
            "name": "CENTRAL SAKWA",
            "loanName": "Central Sakwa"
          },
          {
            "name": "NORTH SAKWA",
            "loanName": "North Sakwa"
          },
          {
            "name": "SOUTH SAKWA",
            "loanName": "South Sakwa"
          },
          {
            "name": "WEST SAKWA",
            "loanName": "West Sakwa"
          },
          {
            "name": "WEST YIMBO",
            "loanName": "West Yimbo"
          },
          {
            "name": "YIMBO EAST",
            "loanName": "Yimbo East"
          }
        ]
      },
      {
        "name": "GEM",
        "loanName": "Gem",
        "wards": [
          {
            "name": "CENTRAL GEM",
            "loanName": "Central Gem"
          },
          {
            "name": "EAST GEM",
            "loanName": "East Gem"
          },
          {
            "name": "NORTH GEM",
            "loanName": "North Gem"
          },
          {
            "name": "SOUTH GEM",
            "loanName": "South Gem"
          },
          {
            "name": "WEST GEM",
            "loanName": "West Gem"
          },
          {
            "name": "YALA TOWNSHIP",
            "loanName": "Yala Township"
          }
        ]
      },
      {
        "name": "RARIEDA",
        "loanName": "Rarieda",
        "wards": [
          {
            "name": "EAST ASEMBO",
            "loanName": "East Asembo"
          },
          {
            "name": "NORTH UYOMA",
            "loanName": "North Uyoma"
          },
          {
            "name": "SOUTH UYOMA",
            "loanName": "South Uyoma"
          },
          {
            "name": "WEST ASEMBO",
            "loanName": "West Asembo"
          },
          {
            "name": "WEST UYOMA",
            "loanName": "West Uyoma"
          }
        ]
      },
      {
        "name": "UGENYA",
        "loanName": "Ugenya",
        "wards": [
          {
            "name": "EAST UGENYA",
            "loanName": "East Ugenya"
          },
          {
            "name": "NORTH UGENYA",
            "loanName": "North Ugenya"
          },
          {
            "name": "UKWALA",
            "loanName": "Ukwala"
          },
          {
            "name": "WEST UGENYA",
            "loanName": "West Ugenya"
          }
        ]
      },
      {
        "name": "UGUNJA",
        "loanName": "Ugunja",
        "wards": [
          {
            "name": "SIDINDI",
            "loanName": "Sidindi"
          },
          {
            "name": "SIGOMERE",
            "loanName": "Sigomere"
          },
          {
            "name": "UGUNJA",
            "loanName": "Ugunja"
          }
        ]
      }
    ]
  },
  {
    "code": 42,
    "name": "Kisumu",
    "loanName": "Kisumu",
    "constituencies": [
      {
        "name": "KISUMU CENTRAL",
        "loanName": "Kisumu Central",
        "wards": [
          {
            "name": "KONDELE",
            "loanName": "Kondele"
          },
          {
            "name": "MARKET MILIMANI",
            "loanName": "Market Milimani"
          },
          {
            "name": "MIGOSI",
            "loanName": "Migosi"
          },
          {
            "name": "NYALENDA B",
            "loanName": "Nyalenda B"
          },
          {
            "name": "RAILWAYS",
            "loanName": "Railways"
          },
          {
            "name": "SHAURIMOYO KALOLENI",
            "loanName": "Shaurimoyo Kaloleni"
          }
        ]
      },
      {
        "name": "KISUMU EAST",
        "loanName": "Kisumu East",
        "wards": [
          {
            "name": "KAJULU",
            "loanName": "Kajulu"
          },
          {
            "name": "KOLWA CENTRAL",
            "loanName": "Kolwa Central"
          },
          {
            "name": "KOLWA EAST",
            "loanName": "Kolwa East"
          },
          {
            "name": "MANYATTA \\\\B\\\\",
            "loanName": "Manyatta \\\\b\\\\"
          },
          {
            "name": "NYALENDA \\\\A\\\\",
            "loanName": "Nyalenda \\\\a\\\\"
          }
        ]
      },
      {
        "name": "KISUMU WEST",
        "loanName": "Kisumu West",
        "wards": [
          {
            "name": "CENTRAL KISUMU",
            "loanName": "Central Kisumu"
          },
          {
            "name": "KISUMU NORTH",
            "loanName": "Kisumu North"
          },
          {
            "name": "NORTH WEST KISUMU",
            "loanName": "North West Kisumu"
          },
          {
            "name": "SOUTH WEST KISUMU",
            "loanName": "South West Kisumu"
          },
          {
            "name": "WEST KISUMU",
            "loanName": "West Kisumu"
          }
        ]
      },
      {
        "name": "MUHORONI",
        "loanName": "Muhoroni",
        "wards": [
          {
            "name": "CHEMELIL",
            "loanName": "Chemelil"
          },
          {
            "name": "MIWANI",
            "loanName": "Miwani"
          },
          {
            "name": "MUHORONI/KORU",
            "loanName": "Muhoroni/koru"
          },
          {
            "name": "OMBEYI",
            "loanName": "Ombeyi"
          }
        ]
      },
      {
        "name": "NYAKACH",
        "loanName": "Nyakach",
        "wards": [
          {
            "name": "CENTRAL NYAKACH",
            "loanName": "Central Nyakach"
          },
          {
            "name": "NORTH NYAKACH",
            "loanName": "North Nyakach"
          },
          {
            "name": "SOUTH EAST NYAKACH",
            "loanName": "South East Nyakach"
          },
          {
            "name": "SOUTH WEST NYAKACH",
            "loanName": "South West Nyakach"
          },
          {
            "name": "WEST NYAKACH",
            "loanName": "West Nyakach"
          }
        ]
      },
      {
        "name": "NYANDO",
        "loanName": "Nyando",
        "wards": [
          {
            "name": "AHERO",
            "loanName": "Ahero"
          },
          {
            "name": "AWASI/ONJIKO",
            "loanName": "Awasi/onjiko"
          },
          {
            "name": "EAST KANO/WAWIDHI",
            "loanName": "East Kano/wawidhi"
          },
          {
            "name": "KABONYO/KANYAGWAL",
            "loanName": "Kabonyo/kanyagwal"
          },
          {
            "name": "KOBURA",
            "loanName": "Kobura"
          }
        ]
      },
      {
        "name": "SEME",
        "loanName": "Seme",
        "wards": [
          {
            "name": "CENTRAL SEME",
            "loanName": "Central Seme"
          },
          {
            "name": "EAST SEME",
            "loanName": "East Seme"
          },
          {
            "name": "NORTH SEME",
            "loanName": "North Seme"
          },
          {
            "name": "WEST SEME",
            "loanName": "West Seme"
          }
        ]
      }
    ]
  },
  {
    "code": 43,
    "name": "Homa Bay",
    "loanName": "Homa Bay",
    "constituencies": [
      {
        "name": "HOMA BAY TOWN",
        "loanName": "Homa Bay Town",
        "wards": [
          {
            "name": "HOMA BAY ARUJO",
            "loanName": "Homa Bay Arujo"
          },
          {
            "name": "HOMA BAY CENTRAL",
            "loanName": "Homa Bay Central"
          },
          {
            "name": "HOMA BAY EAST",
            "loanName": "Homa Bay East"
          },
          {
            "name": "HOMA BAY WEST",
            "loanName": "Homa Bay West"
          }
        ]
      },
      {
        "name": "KABONDO KASIPUL",
        "loanName": "Kabondo Kasipul",
        "wards": [
          {
            "name": "KABONDO EAST",
            "loanName": "Kabondo East"
          },
          {
            "name": "KABONDO WEST",
            "loanName": "Kabondo West"
          },
          {
            "name": "KOJWACH",
            "loanName": "Kojwach"
          },
          {
            "name": "KOKWANYO/KAKELO",
            "loanName": "Kokwanyo/kakelo"
          }
        ]
      },
      {
        "name": "KARACHUONYO",
        "loanName": "Karachuonyo",
        "wards": [
          {
            "name": "CENTRAL",
            "loanName": "Central"
          },
          {
            "name": "KANYALUO",
            "loanName": "Kanyaluo"
          },
          {
            "name": "KENDU BAY TOWN",
            "loanName": "Kendu Bay Town"
          },
          {
            "name": "KIBIRI",
            "loanName": "Kibiri"
          },
          {
            "name": "NORTH KARACHUONYO",
            "loanName": "North Karachuonyo"
          },
          {
            "name": "WANGCHIENG",
            "loanName": "Wangchieng"
          },
          {
            "name": "WEST KARACHUONYO",
            "loanName": "West Karachuonyo"
          }
        ]
      },
      {
        "name": "KASIPUL",
        "loanName": "Kasipul",
        "wards": [
          {
            "name": "CENTRAL KASIPUL",
            "loanName": "Central Kasipul"
          },
          {
            "name": "EAST KAMAGAK",
            "loanName": "East Kamagak"
          },
          {
            "name": "SOUTH KASIPUL",
            "loanName": "South Kasipul"
          },
          {
            "name": "WEST KAMAGAK",
            "loanName": "West Kamagak"
          },
          {
            "name": "WEST KASIPUL",
            "loanName": "West Kasipul"
          }
        ]
      },
      {
        "name": "NDHIWA",
        "loanName": "Ndhiwa",
        "wards": [
          {
            "name": "KABUOCH NORTH",
            "loanName": "Kabuoch North"
          },
          {
            "name": "KABUOCH SOUTH/PALA",
            "loanName": "Kabuoch South/pala"
          },
          {
            "name": "KANYADOTO",
            "loanName": "Kanyadoto"
          },
          {
            "name": "KANYAMWA KOLOGI",
            "loanName": "Kanyamwa Kologi"
          },
          {
            "name": "KANYAMWA KOSEWE",
            "loanName": "Kanyamwa Kosewe"
          },
          {
            "name": "KANYIKELA",
            "loanName": "Kanyikela"
          },
          {
            "name": "KWABWAI",
            "loanName": "Kwabwai"
          }
        ]
      },
      {
        "name": "RANGWE",
        "loanName": "Rangwe",
        "wards": [
          {
            "name": "EAST GEM",
            "loanName": "East Gem"
          },
          {
            "name": "KAGAN",
            "loanName": "Kagan"
          },
          {
            "name": "KOCHIA",
            "loanName": "Kochia"
          },
          {
            "name": "WEST GEM",
            "loanName": "West Gem"
          }
        ]
      },
      {
        "name": "SUBA NORTH",
        "loanName": "Suba North",
        "wards": [
          {
            "name": "GEMBE",
            "loanName": "Gembe"
          },
          {
            "name": "KASGUNGA",
            "loanName": "Kasgunga"
          },
          {
            "name": "LAMBWE",
            "loanName": "Lambwe"
          },
          {
            "name": "MFANGANO ISLAND",
            "loanName": "Mfangano Island"
          },
          {
            "name": "RUSINGA ISLAND",
            "loanName": "Rusinga Island"
          }
        ]
      },
      {
        "name": "SUBA SOUTH",
        "loanName": "Suba South",
        "wards": [
          {
            "name": "GWASSI NORTH",
            "loanName": "Gwassi North"
          },
          {
            "name": "GWASSI SOUTH",
            "loanName": "Gwassi South"
          },
          {
            "name": "KAKSINGRI WEST",
            "loanName": "Kaksingri West"
          },
          {
            "name": "RUMA-KAKSINGRI",
            "loanName": "Ruma-kaksingri"
          }
        ]
      }
    ]
  },
  {
    "code": 44,
    "name": "Migori",
    "loanName": "Migori",
    "constituencies": [
      {
        "name": "AWENDO",
        "loanName": "Awendo",
        "wards": [
          {
            "name": "CENTRAL SAKWA",
            "loanName": "Central Sakwa"
          },
          {
            "name": "NORTH SAKWA",
            "loanName": "North Sakwa"
          },
          {
            "name": "SOUTH SAKWA",
            "loanName": "South Sakwa"
          },
          {
            "name": "WEST SAKWA",
            "loanName": "West Sakwa"
          }
        ]
      },
      {
        "name": "KURIA EAST",
        "loanName": "Kuria East",
        "wards": [
          {
            "name": "GOKEHARAKA/GETAMBWEGA",
            "loanName": "Gokeharaka/getambwega"
          },
          {
            "name": "NTIMARU EAST",
            "loanName": "Ntimaru East"
          },
          {
            "name": "NTIMARU WEST",
            "loanName": "Ntimaru West"
          },
          {
            "name": "NYABASI EAST",
            "loanName": "Nyabasi East"
          },
          {
            "name": "NYABASI WEST",
            "loanName": "Nyabasi West"
          }
        ]
      },
      {
        "name": "KURIA WEST",
        "loanName": "Kuria West",
        "wards": [
          {
            "name": "BUKIRA CENTRL/IKEREGE",
            "loanName": "Bukira Centrl/ikerege"
          },
          {
            "name": "BUKIRA EAST",
            "loanName": "Bukira East"
          },
          {
            "name": "ISIBANIA",
            "loanName": "Isibania"
          },
          {
            "name": "MAKERERO",
            "loanName": "Makerero"
          },
          {
            "name": "MASABA",
            "loanName": "Masaba"
          },
          {
            "name": "NYAMOSENSE/KOMOSOKO",
            "loanName": "Nyamosense/komosoko"
          },
          {
            "name": "TAGARE",
            "loanName": "Tagare"
          }
        ]
      },
      {
        "name": "NYATIKE",
        "loanName": "Nyatike",
        "wards": [
          {
            "name": "GOT KACHOLA",
            "loanName": "Got Kachola"
          },
          {
            "name": "KALER",
            "loanName": "Kaler"
          },
          {
            "name": "KANYASA",
            "loanName": "Kanyasa"
          },
          {
            "name": "MACALDER/KANYARWANDA",
            "loanName": "Macalder/kanyarwanda"
          },
          {
            "name": "MUHURU",
            "loanName": "Muhuru"
          },
          {
            "name": "NORTH KADEM",
            "loanName": "North Kadem"
          }
        ]
      },
      {
        "name": "RONGO",
        "loanName": "Rongo",
        "wards": [
          {
            "name": "CENTRAL KAMAGAMBO",
            "loanName": "Central Kamagambo"
          },
          {
            "name": "EAST KAMAGAMBO",
            "loanName": "East Kamagambo"
          },
          {
            "name": "NORTH KAMAGAMBO",
            "loanName": "North Kamagambo"
          },
          {
            "name": "SOUTH KAMAGAMBO",
            "loanName": "South Kamagambo"
          }
        ]
      },
      {
        "name": "SUNA EAST",
        "loanName": "Suna East",
        "wards": [
          {
            "name": "GOD JOPE",
            "loanName": "God Jope"
          },
          {
            "name": "KAKRAO",
            "loanName": "Kakrao"
          },
          {
            "name": "KWA",
            "loanName": "Kwa"
          },
          {
            "name": "SUNA CENTRAL",
            "loanName": "Suna Central"
          }
        ]
      },
      {
        "name": "SUNA WEST",
        "loanName": "Suna West",
        "wards": [
          {
            "name": "RAGANA-ORUBA",
            "loanName": "Ragana-oruba"
          },
          {
            "name": "WASIMBETE",
            "loanName": "Wasimbete"
          },
          {
            "name": "WASWETA II",
            "loanName": "Wasweta Ii"
          },
          {
            "name": "WIGA",
            "loanName": "Wiga"
          }
        ]
      },
      {
        "name": "URIRI",
        "loanName": "Uriri",
        "wards": [
          {
            "name": "CENTRAL KANYAMKAGO",
            "loanName": "Central Kanyamkago"
          },
          {
            "name": "EAST KANYAMKAGO",
            "loanName": "East Kanyamkago"
          },
          {
            "name": "NORTH KANYAMKAGO",
            "loanName": "North Kanyamkago"
          },
          {
            "name": "SOUTH KANYAMKAGO",
            "loanName": "South Kanyamkago"
          },
          {
            "name": "WEST KANYAMKAGO",
            "loanName": "West Kanyamkago"
          }
        ]
      }
    ]
  },
  {
    "code": 45,
    "name": "Kisii",
    "loanName": "Kisii",
    "constituencies": [
      {
        "name": "BOBASI",
        "loanName": "Bobasi",
        "wards": [
          {
            "name": "BASI BOGETAORIO",
            "loanName": "Basi Bogetaorio"
          },
          {
            "name": "BASI CENTRAL",
            "loanName": "Basi Central"
          },
          {
            "name": "BOBASI BOITANGARE",
            "loanName": "Bobasi Boitangare"
          },
          {
            "name": "BOBASI CHACHE",
            "loanName": "Bobasi Chache"
          },
          {
            "name": "MASIGE EAST",
            "loanName": "Masige East"
          },
          {
            "name": "MASIGE WEST",
            "loanName": "Masige West"
          },
          {
            "name": "NYACHEKI",
            "loanName": "Nyacheki"
          },
          {
            "name": "SAMETA/MOKWERERO",
            "loanName": "Sameta/mokwerero"
          }
        ]
      },
      {
        "name": "BOMACHOGE BORABU",
        "loanName": "Bomachoge Borabu",
        "wards": [
          {
            "name": "BOKIMONGE",
            "loanName": "Bokimonge"
          },
          {
            "name": "BOMBABA BORABU",
            "loanName": "Bombaba Borabu"
          },
          {
            "name": "BOOCHI BORABU",
            "loanName": "Boochi Borabu"
          },
          {
            "name": "MAGENCHE",
            "loanName": "Magenche"
          }
        ]
      },
      {
        "name": "BOMACHOGE CHACHE",
        "loanName": "Bomachoge Chache",
        "wards": [
          {
            "name": "BOOCHI/TENDERE",
            "loanName": "Boochi/tendere"
          },
          {
            "name": "BOSOTI/SENGERA",
            "loanName": "Bosoti/sengera"
          },
          {
            "name": "MAJOGE BASI",
            "loanName": "Majoge Basi"
          }
        ]
      },
      {
        "name": "BONCHARI",
        "loanName": "Bonchari",
        "wards": [
          {
            "name": "BOGIAKUMU",
            "loanName": "Bogiakumu"
          },
          {
            "name": "BOMARIBA",
            "loanName": "Bomariba"
          },
          {
            "name": "BOMORENDA",
            "loanName": "Bomorenda"
          },
          {
            "name": "RIANA",
            "loanName": "Riana"
          }
        ]
      },
      {
        "name": "KITUTU CHACHE NORTH",
        "loanName": "Kitutu Chache North",
        "wards": [
          {
            "name": "KEGOGI",
            "loanName": "Kegogi"
          },
          {
            "name": "MARANI",
            "loanName": "Marani"
          },
          {
            "name": "MONYERERO",
            "loanName": "Monyerero"
          },
          {
            "name": "SENSI",
            "loanName": "Sensi"
          }
        ]
      },
      {
        "name": "KITUTU CHACHE SOUTH",
        "loanName": "Kitutu Chache South",
        "wards": [
          {
            "name": "BOGEKA",
            "loanName": "Bogeka"
          },
          {
            "name": "BOGUSERO",
            "loanName": "Bogusero"
          },
          {
            "name": "KITUTU CENTRAL",
            "loanName": "Kitutu Central"
          },
          {
            "name": "NYAKOE",
            "loanName": "Nyakoe"
          },
          {
            "name": "NYATIEKO",
            "loanName": "Nyatieko"
          }
        ]
      },
      {
        "name": "NYARIBARI CHACHE",
        "loanName": "Nyaribari Chache",
        "wards": [
          {
            "name": "BIRONGO",
            "loanName": "Birongo"
          },
          {
            "name": "BOBARACHO",
            "loanName": "Bobaracho"
          },
          {
            "name": "IBENO",
            "loanName": "Ibeno"
          },
          {
            "name": "KEUMBU",
            "loanName": "Keumbu"
          },
          {
            "name": "KIOGORO",
            "loanName": "Kiogoro"
          },
          {
            "name": "KISII CENTRAL",
            "loanName": "Kisii Central"
          }
        ]
      },
      {
        "name": "NYARIBARI MASABA",
        "loanName": "Nyaribari Masaba",
        "wards": [
          {
            "name": "GESUSU",
            "loanName": "Gesusu"
          },
          {
            "name": "ICHUNI",
            "loanName": "Ichuni"
          },
          {
            "name": "KIAMOKAMA",
            "loanName": "Kiamokama"
          },
          {
            "name": "MASIMBA",
            "loanName": "Masimba"
          },
          {
            "name": "NYAMASIBI",
            "loanName": "Nyamasibi"
          }
        ]
      },
      {
        "name": "SOUTH MUGIRANGO",
        "loanName": "South Mugirango",
        "wards": [
          {
            "name": "BOGETENGA",
            "loanName": "Bogetenga"
          },
          {
            "name": "BORABU / CHITAGO",
            "loanName": "Borabu / Chitago"
          },
          {
            "name": "GETENGA",
            "loanName": "Getenga"
          },
          {
            "name": "MOTICHO",
            "loanName": "Moticho"
          },
          {
            "name": "TABAKA",
            "loanName": "Tabaka"
          }
        ]
      }
    ]
  },
  {
    "code": 46,
    "name": "Nyamira",
    "loanName": "Nyamira",
    "constituencies": [
      {
        "name": "BORABU",
        "loanName": "Borabu",
        "wards": [
          {
            "name": "ESISE",
            "loanName": "Esise"
          },
          {
            "name": "KIABONYORU",
            "loanName": "Kiabonyoru"
          },
          {
            "name": "MEKENENE",
            "loanName": "Mekenene"
          },
          {
            "name": "NYANSIONGO",
            "loanName": "Nyansiongo"
          }
        ]
      },
      {
        "name": "KITUTU MASABA",
        "loanName": "Kitutu Masaba",
        "wards": [
          {
            "name": "GACHUBA",
            "loanName": "Gachuba"
          },
          {
            "name": "GESIMA",
            "loanName": "Gesima"
          },
          {
            "name": "KEMERA",
            "loanName": "Kemera"
          },
          {
            "name": "MAGOMBO",
            "loanName": "Magombo"
          },
          {
            "name": "MANGA",
            "loanName": "Manga"
          },
          {
            "name": "RIGOMA",
            "loanName": "Rigoma"
          }
        ]
      },
      {
        "name": "NORTH MUGIRANGO",
        "loanName": "North Mugirango",
        "wards": [
          {
            "name": "BOKEIRA",
            "loanName": "Bokeira"
          },
          {
            "name": "BOMWAGAMO",
            "loanName": "Bomwagamo"
          },
          {
            "name": "EKERENYO",
            "loanName": "Ekerenyo"
          },
          {
            "name": "ITIBO",
            "loanName": "Itibo"
          },
          {
            "name": "MAGWAGWA",
            "loanName": "Magwagwa"
          }
        ]
      },
      {
        "name": "WEST MUGIRANGO",
        "loanName": "West Mugirango",
        "wards": [
          {
            "name": "BOGICHORA",
            "loanName": "Bogichora"
          },
          {
            "name": "BONYAMATUTA",
            "loanName": "Bonyamatuta"
          },
          {
            "name": "BOSAMARO",
            "loanName": "Bosamaro"
          },
          {
            "name": "NYAMAIYA",
            "loanName": "Nyamaiya"
          },
          {
            "name": "TOWNSHIP",
            "loanName": "Township"
          }
        ]
      }
    ]
  },
  {
    "code": 47,
    "name": "Nairobi City",
    "loanName": "Nairobi",
    "constituencies": [
      {
        "name": "DAGORETTI NORTH",
        "loanName": "Dagoretti North",
        "wards": [
          {
            "name": "GATINA",
            "loanName": "Gatina"
          },
          {
            "name": "KABIRO",
            "loanName": "Kabiro"
          },
          {
            "name": "KAWANGWARE",
            "loanName": "Kawangware"
          },
          {
            "name": "KILELESHWA",
            "loanName": "Kileleshwa"
          },
          {
            "name": "KILIMANI",
            "loanName": "Kilimani"
          }
        ]
      },
      {
        "name": "DAGORETTI SOUTH",
        "loanName": "Dagoretti South",
        "wards": [
          {
            "name": "MUTU-INI",
            "loanName": "Mutu-ini"
          },
          {
            "name": "NGANDO",
            "loanName": "Ngando"
          },
          {
            "name": "RIRUTA",
            "loanName": "Riruta"
          },
          {
            "name": "UTHIRU/RUTHIMITU",
            "loanName": "Uthiru/ruthimitu"
          },
          {
            "name": "WAITHAKA",
            "loanName": "Waithaka"
          }
        ]
      },
      {
        "name": "EMBAKASI CENTRAL",
        "loanName": "Embakasi Central",
        "wards": [
          {
            "name": "KAYOLE CENTRAL",
            "loanName": "Kayole Central"
          },
          {
            "name": "KAYOLE NORTH",
            "loanName": "Kayole North"
          },
          {
            "name": "KAYOLE SOUTH",
            "loanName": "Kayole South"
          },
          {
            "name": "KOMAROCK",
            "loanName": "Komarock"
          },
          {
            "name": "MATOPENI/SPRING VALLEY",
            "loanName": "Matopeni/spring Valley"
          }
        ]
      },
      {
        "name": "EMBAKASI EAST",
        "loanName": "Embakasi East",
        "wards": [
          {
            "name": "EMBAKASI",
            "loanName": "Embakasi"
          },
          {
            "name": "LOWER SAVANNAH",
            "loanName": "Lower Savannah"
          },
          {
            "name": "MIHANGO",
            "loanName": "Mihango"
          },
          {
            "name": "UPPER SAVANNAH",
            "loanName": "Upper Savannah"
          },
          {
            "name": "UTAWALA",
            "loanName": "Utawala"
          }
        ]
      },
      {
        "name": "EMBAKASI NORTH",
        "loanName": "Embakasi North",
        "wards": [
          {
            "name": "DANDORA AREA I",
            "loanName": "Dandora Area I"
          },
          {
            "name": "DANDORA AREA II",
            "loanName": "Dandora Area Ii"
          },
          {
            "name": "DANDORA AREA III",
            "loanName": "Dandora Area Iii"
          },
          {
            "name": "DANDORA AREA IV",
            "loanName": "Dandora Area Iv"
          },
          {
            "name": "KARIOBANGI NORTH",
            "loanName": "Kariobangi North"
          }
        ]
      },
      {
        "name": "EMBAKASI SOUTH",
        "loanName": "Embakasi South",
        "wards": [
          {
            "name": "IMARA DAIMA",
            "loanName": "Imara Daima"
          },
          {
            "name": "KWA NJENGA",
            "loanName": "Kwa Njenga"
          },
          {
            "name": "KWA REUBEN",
            "loanName": "Kwa Reuben"
          },
          {
            "name": "KWARE",
            "loanName": "Kware"
          },
          {
            "name": "PIPELINE",
            "loanName": "Pipeline"
          }
        ]
      },
      {
        "name": "EMBAKASI WEST",
        "loanName": "Embakasi West",
        "wards": [
          {
            "name": "KARIOBANGI SOUTH",
            "loanName": "Kariobangi South"
          },
          {
            "name": "MOWLEM",
            "loanName": "Mowlem"
          },
          {
            "name": "UMOJA I",
            "loanName": "Umoja I"
          },
          {
            "name": "UMOJA II",
            "loanName": "Umoja Ii"
          }
        ]
      },
      {
        "name": "KAMUKUNJI",
        "loanName": "Kamukunji",
        "wards": [
          {
            "name": "AIRBASE",
            "loanName": "Airbase"
          },
          {
            "name": "CALIFORNIA",
            "loanName": "California"
          },
          {
            "name": "EASTLEIGH NORTH",
            "loanName": "Eastleigh North"
          },
          {
            "name": "EASTLEIGH SOUTH",
            "loanName": "Eastleigh South"
          },
          {
            "name": "PUMWANI",
            "loanName": "Pumwani"
          }
        ]
      },
      {
        "name": "KASARANI",
        "loanName": "Kasarani",
        "wards": [
          {
            "name": "CLAY CITY",
            "loanName": "Clay City"
          },
          {
            "name": "KASARANI",
            "loanName": "Kasarani"
          },
          {
            "name": "MWIKI",
            "loanName": "Mwiki"
          },
          {
            "name": "NJIRU",
            "loanName": "Njiru"
          },
          {
            "name": "RUAI",
            "loanName": "Ruai"
          }
        ]
      },
      {
        "name": "KIBRA",
        "loanName": "Kibra",
        "wards": [
          {
            "name": "LAINI SABA",
            "loanName": "Laini Saba"
          },
          {
            "name": "LINDI",
            "loanName": "Lindi"
          },
          {
            "name": "MAKINA",
            "loanName": "Makina"
          },
          {
            "name": "SARANGOMBE",
            "loanName": "Sarangombe"
          },
          {
            "name": "WOODLEY/KENYATTA GOLF COURSE",
            "loanName": "Woodley/kenyatta Golf Course"
          }
        ]
      },
      {
        "name": "LANGATA",
        "loanName": "Langata",
        "wards": [
          {
            "name": "KAREN",
            "loanName": "Karen"
          },
          {
            "name": "MUGUMU-INI",
            "loanName": "Mugumu-ini"
          },
          {
            "name": "NAIROBI WEST",
            "loanName": "Nairobi West"
          },
          {
            "name": "NYAYO HIGHRISE",
            "loanName": "Nyayo Highrise"
          },
          {
            "name": "SOUTH C",
            "loanName": "South C"
          }
        ]
      },
      {
        "name": "MAKADARA",
        "loanName": "Makadara",
        "wards": [
          {
            "name": "HARAMBEE",
            "loanName": "Harambee"
          },
          {
            "name": "MAKONGENI",
            "loanName": "Makongeni"
          },
          {
            "name": "MARINGO/HAMZA",
            "loanName": "Maringo/hamza"
          },
          {
            "name": "VIWANDANI",
            "loanName": "Viwandani"
          }
        ]
      },
      {
        "name": "MATHARE",
        "loanName": "Mathare",
        "wards": [
          {
            "name": "HOSPITAL",
            "loanName": "Hospital"
          },
          {
            "name": "HURUMA",
            "loanName": "Huruma"
          },
          {
            "name": "KIAMAIKO",
            "loanName": "Kiamaiko"
          },
          {
            "name": "MABATINI",
            "loanName": "Mabatini"
          },
          {
            "name": "MLANGO KUBWA",
            "loanName": "Mlango Kubwa"
          },
          {
            "name": "NGEI",
            "loanName": "Ngei"
          }
        ]
      },
      {
        "name": "ROYSAMBU",
        "loanName": "Roysambu",
        "wards": [
          {
            "name": "GITHURAI",
            "loanName": "Githurai"
          },
          {
            "name": "KAHAWA",
            "loanName": "Kahawa"
          },
          {
            "name": "KAHAWA WEST",
            "loanName": "Kahawa West"
          },
          {
            "name": "ROYSAMBU",
            "loanName": "Roysambu"
          },
          {
            "name": "ZIMMERMAN",
            "loanName": "Zimmerman"
          }
        ]
      },
      {
        "name": "RUARAKA",
        "loanName": "Ruaraka",
        "wards": [
          {
            "name": "BABA DOGO",
            "loanName": "Baba Dogo"
          },
          {
            "name": "KOROGOCHO",
            "loanName": "Korogocho"
          },
          {
            "name": "LUCKY SUMMER",
            "loanName": "Lucky Summer"
          },
          {
            "name": "MATHARE NORTH",
            "loanName": "Mathare North"
          },
          {
            "name": "UTALII",
            "loanName": "Utalii"
          }
        ]
      },
      {
        "name": "STAREHE",
        "loanName": "Starehe",
        "wards": [
          {
            "name": "LANDIMAWE",
            "loanName": "Landimawe"
          },
          {
            "name": "NAIROBI CENTRAL",
            "loanName": "Nairobi Central"
          },
          {
            "name": "NAIROBI SOUTH",
            "loanName": "Nairobi South"
          },
          {
            "name": "NGARA",
            "loanName": "Ngara"
          },
          {
            "name": "PANGANI",
            "loanName": "Pangani"
          },
          {
            "name": "ZIWANI/KARIOKOR",
            "loanName": "Ziwani/kariokor"
          }
        ]
      },
      {
        "name": "WESTLANDS",
        "loanName": "Westlands",
        "wards": [
          {
            "name": "KANGEMI",
            "loanName": "Kangemi"
          },
          {
            "name": "KARURA",
            "loanName": "Karura"
          },
          {
            "name": "KITISURU",
            "loanName": "Kitisuru"
          },
          {
            "name": "MOUNTAIN VIEW",
            "loanName": "Mountain View"
          },
          {
            "name": "PARKLANDS/HIGHRIDGE",
            "loanName": "Parklands/highridge"
          }
        ]
      }
    ]
  }
];
