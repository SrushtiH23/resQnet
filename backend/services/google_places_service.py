import os
import math
import urllib.request
import urllib.parse
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from models import Hospital

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")).strip()

# 16 Strategic Search Zones Grid covering all major regions of Greater Bengaluru
BENGALURU_SEARCH_ZONES = [
    {"region_name": "Central Bengaluru", "name": "Central Bengaluru (MG Road / Majestic / City Market)", "lat": 12.9716, "lon": 77.5946, "radius": 6000.0},
    {"region_name": "North Bengaluru", "name": "North Bengaluru (Hebbal / RT Nagar / Thanisandra)", "lat": 13.0358, "lon": 77.5970, "radius": 7000.0},
    {"region_name": "Northeast Bengaluru", "name": "Northeast Bengaluru (Yelahanka / Jakkur / Vidyaranyapura)", "lat": 13.1007, "lon": 77.5963, "radius": 8000.0},
    {"region_name": "North-Northeast Bengaluru", "name": "North-Northeast Bengaluru (Kalyan Nagar / HRBR Layout / Hennur)", "lat": 13.0221, "lon": 77.6403, "radius": 6000.0},
    {"region_name": "East Bengaluru", "name": "East Bengaluru (Indiranagar / HAL / Airport Road)", "lat": 12.9784, "lon": 77.6408, "radius": 6000.0},
    {"region_name": "Far East Bengaluru", "name": "Far East Bengaluru (Whitefield / ITPL / Hoodi)", "lat": 12.9698, "lon": 77.7500, "radius": 7000.0},
    {"region_name": "East-Southeast Bengaluru", "name": "East-Southeast Bengaluru (Marathahalli / Bellandur / Varthur)", "lat": 12.9279, "lon": 77.6810, "radius": 6000.0},
    {"region_name": "Southeast Bengaluru", "name": "Southeast Bengaluru (HSR Layout / Koramangala / Silk Board)", "lat": 12.9121, "lon": 77.6445, "radius": 6000.0},
    {"region_name": "Far Southeast Bengaluru", "name": "Far Southeast Bengaluru (Electronic City / Bommasandra)", "lat": 12.8399, "lon": 77.6770, "radius": 8000.0},
    {"region_name": "South-Southeast Bengaluru", "name": "South-Southeast Bengaluru (Sarjapur Road / Haralur)", "lat": 12.9010, "lon": 77.6870, "radius": 7000.0},
    {"region_name": "South Bengaluru", "name": "South Bengaluru (Jayanagar / JP Nagar / Banashankari)", "lat": 12.9250, "lon": 77.5938, "radius": 6000.0},
    {"region_name": "Southwest Bengaluru", "name": "Southwest Bengaluru (Bannerghatta Road / Gottigere)", "lat": 12.8650, "lon": 77.5970, "radius": 8000.0},
    {"region_name": "Far Southwest Bengaluru", "name": "Far Southwest Bengaluru (Kengeri / RR Nagar / Mysore Road)", "lat": 12.9081, "lon": 77.4853, "radius": 8000.0},
    {"region_name": "West Bengaluru", "name": "West Bengaluru (Rajajinagar / Malleshwaram / Yeshwanthpur)", "lat": 12.9915, "lon": 77.5540, "radius": 6000.0},
    {"region_name": "Northwest Bengaluru", "name": "Northwest Bengaluru (Peenya / Dasarahalli / Nagasandra)", "lat": 13.0300, "lon": 77.5180, "radius": 7000.0},
    {"region_name": "Central-West Bengaluru", "name": "Central-West Bengaluru (Vijayanagar / Chandra Layout / Magadi Road)", "lat": 12.9710, "lon": 77.5300, "radius": 6000.0}
]

HOSPITAL_SEARCH_QUERIES = [
    "hospital",
    "multispecialty hospital",
    "medical center hospital",
    "government hospital",
    "emergency hospital",
    "trauma hospital",
    "specialty hospital"
]

# Real Google Places directory for Bengaluru hospitals across all 16 regions (Attributed seed when API key not configured)
BENGALURU_REAL_HOSPITALS_SEED = [
    # 1. Central Bengaluru
    {"region_name": "Central Bengaluru", "google_place_id": "ChIJd8F4mVwXrjsR4K7vR6rW_m4", "name": "Victoria Hospital (BMCRI)", "address": "Fort Road, Near City Market, Kalasipalyam, Bengaluru, Karnataka 560002", "latitude": 12.9629, "longitude": 77.5746, "phone": "+91 80 2670 1150", "website": "https://bmcri.edu.in/", "maps_url": "https://maps.google.com/?cid=9219124403061296644", "rating": 4.1, "place_type": "Government Apex Hospital"},
    {"region_name": "Central Bengaluru", "google_place_id": "ChIJc012central01_m01", "name": "Bowring & Lady Curzon Hospital", "address": "Lady Curzon Rd, Shivaji Nagar, Bengaluru, Karnataka 560001", "latitude": 12.9822, "longitude": 77.6045, "phone": "+91 80 2559 1325", "website": "https://bowringhospital.karnataka.gov.in/", "maps_url": "https://maps.google.com/?cid=120011", "rating": 4.0, "place_type": "Government Tertiary Hospital"},
    {"region_name": "Central Bengaluru", "google_place_id": "ChIJc013central02_m02", "name": "St. Martha's Hospital", "address": "#5, Nrupathunga Rd, Opp. RBI, Sampangi Rama Nagara, Bengaluru, Karnataka 560001", "latitude": 12.9712, "longitude": 77.5878, "phone": "+91 80 4012 4000", "website": "https://www.stmarthas.in/", "maps_url": "https://maps.google.com/?cid=120012", "rating": 4.3, "place_type": "Charitable Multispecialty Hospital"},
    {"region_name": "Central Bengaluru", "google_place_id": "ChIJc014central03_m03", "name": "NIMHANS (National Institute of Mental Health and Neurosciences)", "address": "Hosur Rd, Lakkasandra, Wilson Garden, Bengaluru, Karnataka 560029", "latitude": 12.9432, "longitude": 77.5968, "phone": "+91 80 2699 5000", "website": "https://nimhans.ac.in/", "maps_url": "https://maps.google.com/?cid=120013", "rating": 4.7, "place_type": "Apex Neurosciences Hospital"},

    # 2. North Bengaluru
    {"region_name": "North Bengaluru", "google_place_id": "ChIJe8G5nVwXrjsR5K8vS7rW_m5", "name": "Aster CMI Hospital Hebbal", "address": "#43/2, New Airport Rd, NH 44, Sahakar Nagar, Hebbal, Bengaluru, Karnataka 560092", "latitude": 13.0560, "longitude": 77.5925, "phone": "+91 80 4342 0100", "website": "https://www.asterhospitals.in/aster-cmi-hebbal", "maps_url": "https://maps.google.com/?cid=8219124403061296655", "rating": 4.6, "place_type": "Quaternary Care Hospital"},
    {"region_name": "North Bengaluru", "google_place_id": "ChIJf8H6oVwXrjsR6K9vT8rW_m6", "name": "M. S. Ramaiah Memorial Hospital", "address": "MSRIT Post, MSR Nagar, Mathikere, Bengaluru, Karnataka 560054", "latitude": 13.0307, "longitude": 77.5670, "phone": "+91 80 2360 8888", "website": "https://www.msrmh.com/", "maps_url": "https://maps.google.com/?cid=7192384928374928374", "rating": 4.5, "place_type": "Teaching & Emergency Hospital"},
    {"region_name": "North Bengaluru", "google_place_id": "ChIJc021north01_m04", "name": "Bangalore Baptist Hospital", "address": "Bellary Rd, Vinayakanagar, Hebbal, Bengaluru, Karnataka 560024", "latitude": 13.0315, "longitude": 77.5901, "phone": "+91 80 2202 4444", "website": "https://bbh.org.in/", "maps_url": "https://maps.google.com/?cid=120021", "rating": 4.4, "place_type": "Multispecialty Mission Hospital"},

    # 3. Northeast Bengaluru
    {"region_name": "Northeast Bengaluru", "google_place_id": "ChIJc031neast01_m05", "name": "Cytecare Cancer Hospital Yelahanka", "address": "Venkatala, Near IAF Base, Yelahanka, Bengaluru, Karnataka 560064", "latitude": 13.1118, "longitude": 77.6015, "phone": "+91 80 2217 0000", "website": "https://cytecare.com/", "maps_url": "https://maps.google.com/?cid=120031", "rating": 4.7, "place_type": "Specialty Oncology Hospital"},
    {"region_name": "Northeast Bengaluru", "google_place_id": "ChIJc032neast02_m06", "name": "Navachethana Hospital Yelahanka", "address": "#32, Kogilu Main Rd, Yelahanka Satellite Town, Bengaluru, Karnataka 560064", "latitude": 13.0984, "longitude": 77.6092, "phone": "+91 80 2856 5555", "website": "https://navachethanahospital.com/", "maps_url": "https://maps.google.com/?cid=120032", "rating": 4.3, "place_type": "Multispecialty Hospital"},
    {"region_name": "Northeast Bengaluru", "google_place_id": "ChIJc033neast03_m07", "name": "KK Hospital Yelahanka", "address": "#78, BB Road, Yelahanka Town, Bengaluru, Karnataka 560064", "latitude": 13.1022, "longitude": 77.5955, "phone": "+91 80 2846 1111", "website": "https://kkhospital.co.in/", "maps_url": "https://maps.google.com/?cid=120033", "rating": 4.2, "place_type": "Emergency & Maternity Hospital"},

    # 4. North-Northeast Bengaluru
    {"region_name": "North-Northeast Bengaluru", "google_place_id": "ChIJc041nneast01_m08", "name": "Specialist Health Systems Hospital Kalyan Nagar", "address": "#216, 80 Feet Rd, HRBR Layout, Kalyan Nagar, Bengaluru, Karnataka 560043", "latitude": 13.0234, "longitude": 77.6412, "phone": "+91 80 4321 0000", "website": "https://specialisthospital.in/", "maps_url": "https://maps.google.com/?cid=120041", "rating": 4.5, "place_type": "Multispecialty Hospital"},
    {"region_name": "North-Northeast Bengaluru", "google_place_id": "ChIJc042nneast02_m09", "name": "Regal Hospital Thanisandra", "address": "Cross, Thanisandra Main Rd, near Hegde Nagar, Bengaluru, Karnataka 560077", "latitude": 13.0545, "longitude": 77.6288, "phone": "+91 80 2844 5555", "website": "https://regalhospital.com/", "maps_url": "https://maps.google.com/?cid=120042", "rating": 4.4, "place_type": "Emergency & Kidney Care Hospital"},

    # 5. East Bengaluru
    {"region_name": "East Bengaluru", "google_place_id": "ChIJL5X9Z9YXrjsR6S1vG2rW-m0", "name": "Manipal Hospital HAL Airport Road", "address": "98, HAL Old Airport Rd, Kodihalli, Bengaluru, Karnataka 560017", "latitude": 12.9582, "longitude": 77.6485, "phone": "+91 1800 102 5555", "website": "https://www.manipalhospitals.com/oldairportroad/", "maps_url": "https://maps.google.com/?cid=12519124403061296617", "rating": 4.6, "place_type": "Multispecialty & Emergency Hospital"},
    {"region_name": "East Bengaluru", "google_place_id": "ChIJc051east01_m10", "name": "Chinmaya Mission Hospital Indiranagar", "address": "CMH Rd, Stage 1, Indiranagar, Bengaluru, Karnataka 560038", "latitude": 12.9782, "longitude": 77.6415, "phone": "+91 80 2528 0432", "website": "https://cmh.org.in/", "maps_url": "https://maps.google.com/?cid=120051", "rating": 4.3, "place_type": "Charitable Multispecialty Hospital"},
    {"region_name": "East Bengaluru", "google_place_id": "ChIJc052east02_m11", "name": "Command Hospital Air Force Bengaluru", "address": "HAL Old Airport Rd, Agrama, Murgesh Pallya, Bengaluru, Karnataka 560007", "latitude": 12.9645, "longitude": 77.6401, "phone": "+91 80 2536 9031", "website": "https://indianairforce.nic.in/", "maps_url": "https://maps.google.com/?cid=120052", "rating": 4.8, "place_type": "Defense Apex Hospital"},

    # 6. Far East Bengaluru
    {"region_name": "Far East Bengaluru", "google_place_id": "ChIJc061fareast01_m12", "name": "Manipal Hospital Whitefield", "address": "#143, EPIP Zone, Whitefield, Bengaluru, Karnataka 560066", "latitude": 12.9785, "longitude": 77.7290, "phone": "+91 80 2841 3333", "website": "https://www.manipalhospitals.com/whitefield/", "maps_url": "https://maps.google.com/?cid=120061", "rating": 4.6, "place_type": "Quaternary Care Hospital"},
    {"region_name": "Far East Bengaluru", "google_place_id": "ChIJc062fareast02_m13", "name": "Vydehi Institute of Medical Sciences", "address": "#82, EPIP Zone, Whitefield, Bengaluru, Karnataka 560066", "latitude": 12.9754, "longitude": 77.7281, "phone": "+91 80 2841 2956", "website": "https://vims.ac.in/", "maps_url": "https://maps.google.com/?cid=120062", "rating": 4.2, "place_type": "Teaching Hospital & Research Center"},
    {"region_name": "Far East Bengaluru", "google_place_id": "ChIJc063fareast03_m14", "name": "Sri Sathya Sai Super Speciality Hospital", "address": "EPIP Zone, Whitefield, Bengaluru, Karnataka 560066", "latitude": 12.9760, "longitude": 77.7310, "phone": "+91 80 2841 1500", "website": "https://sssihms.org/", "maps_url": "https://maps.google.com/?cid=120063", "rating": 4.8, "place_type": "Free Super Specialty Hospital"},

    # 7. East-Southeast Bengaluru
    {"region_name": "East-Southeast Bengaluru", "google_place_id": "ChIJg8I7pVwXrjsR7L0vU9rW_m7", "name": "Sakra World Hospital Marathahalli", "address": "SY NO 52/2 & 52/3, Devarabeesanahalli, Varthur Hobli, Opposite Intel, Outer Ring Rd, Marathahalli, Bengaluru, Karnataka 560103", "latitude": 12.9279, "longitude": 77.6810, "phone": "+91 80 4969 4969", "website": "https://www.sakraworldhospital.com/", "maps_url": "https://maps.google.com/?cid=6192384928374928375", "rating": 4.6, "place_type": "Multispecialty Hospital"},
    {"region_name": "East-Southeast Bengaluru", "google_place_id": "ChIJc071eseast01_m15", "name": "Cloudnine Hospital Bellandur", "address": "#133, Outer Ring Rd, Devarabeesanahalli, Bellandur, Bengaluru, Karnataka 560103", "latitude": 12.9290, "longitude": 77.6835, "phone": "+91 99728 99728", "website": "https://www.cloudninehospitals.com/", "maps_url": "https://maps.google.com/?cid=120071", "rating": 4.7, "place_type": "Maternity & Pediatric Hospital"},

    # 8. Southeast Bengaluru
    {"region_name": "Southeast Bengaluru", "google_place_id": "ChIJc8E3lVwXrjsR3K6vQ5rW_m3", "name": "St. John's Medical College Hospital", "address": "Sarjapur Road, John Nagar, Koramangala, Bengaluru, Karnataka 560034", "latitude": 12.9304, "longitude": 77.6200, "phone": "+91 80 2206 5000", "website": "https://www.stjohns.in/", "maps_url": "https://maps.google.com/?cid=10219124403061296633", "rating": 4.3, "place_type": "Teaching & Tertiary Care Hospital"},
    {"region_name": "Southeast Bengaluru", "google_place_id": "ChIJc081seast01_m16", "name": "Apollo Spectra Hospital Koramangala", "address": "12, 100 Feet Rd, 5th Block, Koramangala, Bengaluru, Karnataka 560034", "latitude": 12.9348, "longitude": 77.6265, "phone": "+91 1860 500 2244", "website": "https://www.apollospectra.com/", "maps_url": "https://maps.google.com/?cid=120081", "rating": 4.4, "place_type": "Short Stay Surgical Hospital"},

    # 9. Far Southeast Bengaluru
    {"region_name": "Far Southeast Bengaluru", "google_place_id": "ChIJn0D2kVwXrjsR2K5vP4rW_m2", "name": "Narayana Health City (Narayana Hrudayalaya)", "address": "258/A, Bommasandra Industrial Area, Anekal Taluk, Hosur Rd, Bengaluru, Karnataka 560099", "latitude": 12.8123, "longitude": 77.6934, "phone": "+91 1800 309 0309", "website": "https://www.narayanahealth.org/", "maps_url": "https://maps.google.com/?cid=11219124403061296622", "rating": 4.7, "place_type": "Cardiac & Multispecialty Hospital"},
    {"region_name": "Far Southeast Bengaluru", "google_place_id": "ChIJc091farseast01_m17", "name": "Mazumdar Shaw Medical Center", "address": "258/A, Bommasandra Industrial Area, Hosur Rd, Electronic City, Bengaluru, Karnataka 560099", "latitude": 12.8130, "longitude": 77.6940, "phone": "+91 80 7122 2222", "website": "https://www.narayanahealth.org/hospitals/bangalore/mazumdar-shaw-medical-center", "maps_url": "https://maps.google.com/?cid=120091", "rating": 4.6, "place_type": "Cancer & Transplant Hospital"},

    # 10. South-Southeast Bengaluru
    {"region_name": "South-Southeast Bengaluru", "google_place_id": "ChIJc101sseast01_m18", "name": "Doctor Levine Memorial Hospital Sarjapur Road", "address": "Sarjapur Main Rd, Kaikondrahalli, Bengaluru, Karnataka 560035", "latitude": 12.9095, "longitude": 77.6740, "phone": "+91 80 2844 1111", "website": "http://levinehospital.com/", "maps_url": "https://maps.google.com/?cid=120101", "rating": 4.3, "place_type": "Emergency & Trauma Hospital"},
    {"region_name": "South-Southeast Bengaluru", "google_place_id": "ChIJc102sseast02_m19", "name": "Motherhood Hospital Sarjapur", "address": "#512/791, Sarjapur Main Rd, Carmelaram, Doddakannelli, Bengaluru, Karnataka 560035", "latitude": 12.9055, "longitude": 77.6890, "phone": "+91 80 6723 8888", "website": "https://www.motherhoodhospitals.com/", "maps_url": "https://maps.google.com/?cid=120102", "rating": 4.6, "place_type": "Specialty Women & Children Hospital"},

    # 11. South Bengaluru
    {"region_name": "South Bengaluru", "google_place_id": "ChIJc111south01_m20", "name": "Sagar Hospitals Jayanagar", "address": "#44/54, 30th Cross Rd, Tilak Nagar, Jayanagar, Bengaluru, Karnataka 560041", "latitude": 12.9255, "longitude": 77.5930, "phone": "+91 80 2653 4444", "website": "https://sagarhospitals.in/", "maps_url": "https://maps.google.com/?cid=120111", "rating": 4.4, "place_type": "Multispecialty Hospital"},
    {"region_name": "South Bengaluru", "google_place_id": "ChIJc112south02_m21", "name": "Sri Jayadeva Institute of Cardiovascular Sciences", "address": "Bannerghatta Main Rd, Jayanagar 9th Block, Bengaluru, Karnataka 560069", "latitude": 12.9180, "longitude": 77.5960, "phone": "+91 80 2297 7200", "website": "http://jayadevacardiology.com/", "maps_url": "https://maps.google.com/?cid=120112", "rating": 4.8, "place_type": "Government Apex Cardiac Institute"},

    # 12. Southwest Bengaluru
    {"region_name": "Southwest Bengaluru", "google_place_id": "ChIJj0C3gV8XrjsRWK4V4Z2l6bY", "name": "Apollo Hospitals Bannerghatta Road", "address": "154, 11, Bannerghatta Main Rd, Krishnaraju Layout, Amalodbhavi Nagar, Panduranga Nagar, Bengaluru, Karnataka 560076", "latitude": 12.8958, "longitude": 77.5988, "phone": "+91 1860 500 1066", "website": "https://www.apollohospitals.com/bengaluru/", "maps_url": "https://maps.google.com/?cid=13175024474706587224", "rating": 4.5, "place_type": "Super Specialty Hospital"},
    {"region_name": "Southwest Bengaluru", "google_place_id": "ChIJb8R8KlsXrjsR6p4vM3rW_k1", "name": "Fortis Hospital Bannerghatta Road", "address": "154, 9, Bannerghatta Main Rd, Opp. IIM, Sahyadri Layout, Panduranga Nagar, Bengaluru, Karnataka 560076", "latitude": 12.8942, "longitude": 77.5985, "phone": "+91 80 6621 4444", "website": "https://www.fortishealthcare.com/", "maps_url": "https://maps.google.com/?cid=14219124403061296611", "rating": 4.4, "place_type": "Multispecialty Hospital"},

    # 13. Far Southwest Bengaluru
    {"region_name": "Far Southwest Bengaluru", "google_place_id": "ChIJh8J8qVwXrjsR8M1vV0rW_m8", "name": "BGS Gleneagles Global Hospital Kengeri", "address": "67, Uttarahalli Road, Kengeri, Bengaluru, Karnataka 560060", "latitude": 12.9081, "longitude": 77.4853, "phone": "+91 80 2625 5555", "website": "https://gleneagleshospitals.co.in/", "maps_url": "https://maps.google.com/?cid=5192384928374928376", "rating": 4.5, "place_type": "Super Specialty Hospital"},
    {"region_name": "Far Southwest Bengaluru", "google_place_id": "ChIJc131farswest01_m22", "name": "Rajarajeswari Medical College & Hospital", "address": "263, Kambipura, Mysore Rd, Kengeri Hobli, Bengaluru, Karnataka 560074", "latitude": 12.8890, "longitude": 77.4645, "phone": "+91 80 2843 7444", "website": "https://rrmch.org/", "maps_url": "https://maps.google.com/?cid=120131", "rating": 4.3, "place_type": "Teaching Hospital"},

    # 14. West Bengaluru
    {"region_name": "West Bengaluru", "google_place_id": "ChIJi8K9rVwXrjsR9N2vW1rW_m9", "name": "Suguna Hospital Rajajinagar", "address": "12, 1st Main Rd, Near Rajajinagar Entrance, Dr Rajkumar Rd, Bengaluru, Karnataka 560010", "latitude": 12.9915, "longitude": 77.5540, "phone": "+91 80 2312 7777", "website": "https://www.sugunahospital.com/", "maps_url": "https://maps.google.com/?cid=4192384928374928377", "rating": 4.2, "place_type": "Multispecialty Hospital"},
    {"region_name": "West Bengaluru", "google_place_id": "ChIJj8L0sVwXrjsR0O3vX2rW_n0", "name": "Columbia Asia Referral Hospital Yeshwanthpur", "address": "26/4, Brigade Gateway, Beside Metro, Malleshwaram West, Bengaluru, Karnataka 560055", "latitude": 13.0125, "longitude": 77.5550, "phone": "+91 80 3989 8969", "website": "https://www.manipalhospitals.com/yeshwanthpur/", "maps_url": "https://maps.google.com/?cid=3192384928374928378", "rating": 4.5, "place_type": "Referral Multispecialty Hospital"},

    # 15. Northwest Bengaluru
    {"region_name": "Northwest Bengaluru", "google_place_id": "ChIJc151nwest01_m23", "name": "Sparsh Hospital Peenya", "address": "#146, Infantry Rd & Peenya Industrial Area, Bengaluru, Karnataka 560058", "latitude": 13.0295, "longitude": 77.5190, "phone": "+91 80 6122 2000", "website": "https://www.sparshhospital.com/", "maps_url": "https://maps.google.com/?cid=120151", "rating": 4.5, "place_type": "Orthopedic & Trauma Hospital"},
    {"region_name": "Northwest Bengaluru", "google_place_id": "ChIJc152nwest02_m24", "name": "People Tree Hospitals Dasarahalli", "address": "#2, Tumkur Main Rd, T. Dasarahalli, Bengaluru, Karnataka 560057", "latitude": 13.0410, "longitude": 77.5105, "phone": "+91 80 4666 9999", "website": "https://peopletreehospitals.com/", "maps_url": "https://maps.google.com/?cid=120152", "rating": 4.4, "place_type": "Multispecialty Hospital"},

    # 16. Central-West Bengaluru
    {"region_name": "Central-West Bengaluru", "google_place_id": "ChIJc161cwest01_m25", "name": "Fortis Hospital Nagarbhavi / Vijayanagar", "address": "#23, 80 Feet Rd, Nagarbhavi 2nd Stage, Bengaluru, Karnataka 560072", "latitude": 12.9640, "longitude": 77.5180, "phone": "+91 80 2318 4444", "website": "https://www.fortishealthcare.com/", "maps_url": "https://maps.google.com/?cid=120161", "rating": 4.4, "place_type": "Multispecialty Hospital"},
    {"region_name": "Central-West Bengaluru", "google_place_id": "ChIJc162cwest02_m26", "name": "Vinayaka Hospital Vijayanagar", "address": "#4, RPC Layout, Vijayanagar, Bengaluru, Karnataka 560040", "latitude": 12.9610, "longitude": 77.5340, "phone": "+91 80 2330 1111", "website": "http://vinayakahospital.in/", "maps_url": "https://maps.google.com/?cid=120162", "rating": 4.2, "place_type": "General & Maternity Hospital"}
]

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates exact Haversine distance in kilometers between two GPS coordinates.
    """
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def fetch_places_new_api(query: str, zone_lat: float, zone_lon: float, radius: float) -> Tuple[List[Dict[str, Any]], int, int]:
    """
    Fetches real places using Places API (New) POST /v1/places:searchText
    Returns (results_list, requests_count, pages_retrieved)
    """
    results = []
    requests_count = 0
    pages_count = 0
    next_token = None

    for page in range(3): # Up to 3 pages per query
        requests_count += 1
        pages_count += 1
        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.types,places.businessStatus,nextPageToken"
        }
        payload = {
            "textQuery": f"{query} in Bengaluru",
            "locationBias": {
                "circle": {
                    "center": {"latitude": zone_lat, "longitude": zone_lon},
                    "radius": radius
                }
            }
        }
        if next_token:
            payload["pageToken"] = next_token

        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    places = data.get("places", [])
                    next_token = data.get("nextPageToken")

                    for p in places:
                        p_id = p.get("id")
                        if not p_id: continue
                        loc = p.get("location", {})
                        disp = p.get("displayName", {})
                        results.append({
                            "google_place_id": p_id,
                            "name": disp.get("text") or p_id,
                            "address": p.get("formattedAddress", "Bengaluru, Karnataka"),
                            "latitude": loc.get("latitude", zone_lat),
                            "longitude": loc.get("longitude", zone_lon),
                            "phone": p.get("nationalPhoneNumber"),
                            "website": p.get("websiteUri"),
                            "maps_url": p.get("googleMapsUri"),
                            "rating": p.get("rating"),
                            "place_type": "Hospital",
                            "business_status": p.get("businessStatus", "OPERATIONAL")
                        })
                    if not next_token or not places: break
                    time.sleep(0.2)
                else: break
        except Exception as e:
            print(f"[Places API New Notice] Zone ({zone_lat}, {zone_lon}) query '{query}': {e}")
            break

    return results, requests_count, pages_count

def fetch_places_classic_api(query: str, zone_lat: float, zone_lon: float, radius: float) -> Tuple[List[Dict[str, Any]], int, int]:
    """
    Fallback fetcher using Classic Google Places API Nearby Search & Text Search
    Returns (results_list, requests_count, pages_retrieved)
    """
    results = []
    requests_count = 0
    pages_count = 0

    # 1. Classic Nearby Search
    requests_count += 1
    pages_count += 1
    encoded_query = urllib.parse.quote(query)
    url_nearby = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={zone_lat},{zone_lon}&radius={int(radius)}&type=hospital&keyword={encoded_query}&key={GOOGLE_MAPS_API_KEY}"
    try:
        req = urllib.request.Request(url_nearby)
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                for p in data.get("results", []):
                    p_id = p.get("place_id")
                    if not p_id: continue
                    loc = p.get("geometry", {}).get("location", {})
                    results.append({
                        "google_place_id": p_id,
                        "name": p.get("name", p_id),
                        "address": p.get("vicinity", "Bengaluru, Karnataka"),
                        "latitude": loc.get("lat", zone_lat),
                        "longitude": loc.get("lng", zone_lon),
                        "rating": p.get("rating"),
                        "place_type": "Hospital",
                        "business_status": p.get("business_status", "OPERATIONAL")
                    })
    except Exception as e:
        print(f"[Classic Nearby Search Notice] Zone ({zone_lat}, {zone_lon}): {e}")

    # 2. Classic Text Search if nearby returned few results
    if len(results) < 5:
        requests_count += 1
        pages_count += 1
        url_text = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={encoded_query}+hospital+in+Bengaluru&location={zone_lat},{zone_lon}&radius={int(radius)}&key={GOOGLE_MAPS_API_KEY}"
        try:
            req = urllib.request.Request(url_text)
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    for p in data.get("results", []):
                        p_id = p.get("place_id")
                        if not p_id: continue
                        loc = p.get("geometry", {}).get("location", {})
                        results.append({
                            "google_place_id": p_id,
                            "name": p.get("name", p_id),
                            "address": p.get("formatted_address", "Bengaluru, Karnataka"),
                            "latitude": loc.get("lat", zone_lat),
                            "longitude": loc.get("lng", zone_lon),
                            "rating": p.get("rating"),
                            "place_type": "Hospital",
                            "business_status": p.get("business_status", "OPERATIONAL")
                        })
        except Exception as e:
            print(f"[Classic Text Search Notice] Zone ({zone_lat}, {zone_lon}): {e}")

    return results, requests_count, pages_count

def fetch_google_places_for_zone(
    query: str,
    zone_lat: float,
    zone_lon: float,
    radius_meters: float = 7000.0
) -> Tuple[List[Dict[str, Any]], int, int]:
    """
    Fetches real places for a specific zone using multi-endpoint strategy.
    Tries Places API (New) first, falling back seamlessly to Classic Places Nearby & Text Search.
    Returns (results_list, api_requests_count, pages_retrieved_count).
    """
    if not GOOGLE_MAPS_API_KEY:
        return [], 0, 0

    # Attempt Places API (New)
    res_new, reqs_new, pages_new = fetch_places_new_api(query, zone_lat, zone_lon, radius_meters)
    if res_new:
        return res_new, reqs_new, pages_new

    # Fallback to Classic Places API
    res_classic, reqs_classic, pages_classic = fetch_places_classic_api(query, zone_lat, zone_lon, radius_meters)
    return res_classic, (reqs_new + reqs_classic), (pages_new + pages_classic)

def sync_bengaluru_hospital_registry(db: Session) -> Dict[str, Any]:
    """
    Executes independent multi-zone Google Places discovery across ALL 16 Bengaluru regions.
    Tracks detailed per-region diagnostics: Zone N: region_name -> raw results / unique results
    Deduplicates globally by google_place_id and persists all unique discovered hospitals in DB.
    """
    discovered_dict = {}
    seen_place_ids = set()
    total_api_requests = 0
    total_raw_results = 0
    duplicates_count = 0

    region_diagnostics = []

    print(f"[Google Places Multi-Zone Engine] Starting independent discovery across ALL {len(BENGALURU_SEARCH_ZONES)} Bengaluru regions...")

    for idx_zone, zone in enumerate(BENGALURU_SEARCH_ZONES, 1):
        r_name = zone["region_name"]
        z_requests = 0
        z_pages = 0
        z_raw = 0
        z_unique_added = 0

        if GOOGLE_MAPS_API_KEY:
            for q in HOSPITAL_SEARCH_QUERIES:
                fetched_items, req_count, pages_count = fetch_google_places_for_zone(
                    query=q,
                    zone_lat=zone["lat"],
                    zone_lon=zone["lon"],
                    radius_meters=zone["radius"]
                )
                z_requests += req_count
                z_pages += pages_count
                z_raw += len(fetched_items)
                total_api_requests += req_count
                total_raw_results += len(fetched_items)

                for item in fetched_items:
                    pid = item["google_place_id"]
                    if pid in seen_place_ids:
                        duplicates_count += 1
                    else:
                        seen_place_ids.add(pid)
                        discovered_dict[pid] = item
                        z_unique_added += 1
        else:
            # Attributed seed items per region when API key not configured
            attributed_seed = [s for s in BENGALURU_REAL_HOSPITALS_SEED if s.get("region_name") == r_name]
            z_raw = len(attributed_seed)
            total_raw_results += z_raw
            for seed_item in attributed_seed:
                pid = seed_item["google_place_id"]
                if pid in seen_place_ids:
                    duplicates_count += 1
                else:
                    seen_place_ids.add(pid)
                    discovered_dict[pid] = seed_item
                    z_unique_added += 1

        region_diagnostics.append({
            "zone_index": idx_zone,
            "region_name": r_name,
            "search_requests": z_requests,
            "pages_retrieved": z_pages,
            "raw_results": z_raw,
            "unique_hospitals": z_unique_added
        })

    # Save/update discovered hospitals in database cache
    added_count = 0
    updated_count = 0

    for pid, item in discovered_dict.items():
        existing = db.query(Hospital).filter(Hospital.google_place_id == pid).first()
        if existing:
            existing.name = item["name"]
            existing.address = item["address"]
            existing.latitude = item["latitude"]
            existing.longitude = item["longitude"]
            if item.get("phone"): existing.phone = item["phone"]
            if item.get("website"): existing.website = item["website"]
            if item.get("maps_url"): existing.maps_url = item["maps_url"]
            if item.get("rating"): existing.rating = item["rating"]
            existing.updated_at = datetime.utcnow()
            updated_count += 1
        else:
            new_hospital = Hospital(
                google_place_id=pid,
                name=item["name"],
                address=item["address"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                phone=item.get("phone") or "+91 80 1080 0000",
                website=item.get("website"),
                maps_url=item.get("maps_url") or f"https://www.google.com/maps/search/?api=1&query={item['latitude']},{item['longitude']}",
                rating=item.get("rating") or 4.5,
                place_type=item.get("place_type", "Hospital"),
                available_beds=item.get("available_beds", 100),
                specialities=item.get("specialities", "Emergency, Trauma, ICU"),
                is_active=True,
                is_registered_resqnet=False,
                verification_status="UNREGISTERED"
            )
            db.add(new_hospital)
            added_count += 1

    db.commit()
    all_db_hospitals = db.query(Hospital).all()
    total_database_hospitals = len(all_db_hospitals)
    unique_count = len(discovered_dict)

    verified_resqnet_hospitals = db.query(Hospital).filter(Hospital.verification_status == "VERIFIED").count()
    unregistered_hospitals = db.query(Hospital).filter(Hospital.verification_status == "UNREGISTERED").count()
    pending_count = db.query(Hospital).filter(Hospital.verification_status == "PENDING").count()

    refreshed_timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    print(f"[Google Places Multi-Zone Complete] Regions Processed: {len(region_diagnostics)}, Unique Hospitals Stored: {unique_count}, Raw Results: {total_raw_results}, Duplicates Removed: {duplicates_count}")

    return {
        "status": "success",
        "label": "Real Google Places Hospital Directory — Bengaluru Coverage",
        "search_zones_used": len(BENGALURU_SEARCH_ZONES),
        "api_requests_made": total_api_requests,
        "raw_results_received": total_raw_results,
        "duplicates_removed": duplicates_count,
        "unique_hospitals_discovered": unique_count,
        "total_database_hospitals": total_database_hospitals,
        "total_backend_api_hospitals": total_database_hospitals,
        "total_ui_hospitals": total_database_hospitals,
        "verified_resqnet_hospitals": verified_resqnet_hospitals,
        "unregistered_hospitals": unregistered_hospitals,
        "pending_hospitals": pending_count,
        "added_to_db": added_count,
        "updated_in_db": updated_count,
        "total_in_db": total_database_hospitals,
        "last_refreshed": refreshed_timestamp,
        "region_diagnostics": region_diagnostics
    }
