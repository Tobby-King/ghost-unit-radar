"""Tiny offline gazetteer used to describe where mis-geocoded polling units land.
Covers the places where INEC-published coordinates actually fall outside Nigeria
(clusters found in the 2022 dataset), plus neighbouring countries. Offline by design:
no reverse-geocoding service is called."""
from .geo import haversine_km

PLACES = [
    # Canada (largest cluster: southern Ontario)
    ("Waterloo, Canada", 43.4643, -80.5204), ("Kitchener, Canada", 43.4516, -80.4925),
    ("Guelph, Canada", 43.5448, -80.2482), ("Cambridge, Canada", 43.3616, -80.3144),
    ("Toronto, Canada", 43.6532, -79.3832), ("Hamilton, Canada", 43.2557, -79.8711),
    ("London, Canada", 42.9849, -81.2453), ("Stratford, Canada", 43.3700, -80.9822),
    ("Owen Sound, Canada", 44.5690, -80.9406), ("Barrie, Canada", 44.3894, -79.6903),
    ("Orangeville, Canada", 43.9200, -80.0943), ("Collingwood, Canada", 44.5008, -80.2169),
    ("Goderich, Canada", 43.7428, -81.7139), ("Peterborough, Canada", 44.3091, -78.3197),
    ("Ottawa, Canada", 45.4215, -75.6972), ("Montreal, Canada", 45.5019, -73.5674),
    ("Windsor, Canada", 42.3149, -83.0364), ("Sarnia, Canada", 42.9745, -82.4066),
    ("Huntsville, Canada", 45.3269, -79.2167), ("Vancouver, Canada", 49.2827, -123.1207),
    ("Victoria, Canada", 48.4284, -123.3656), ("Winnipeg, Canada", 49.8951, -97.1384),
    ("Kenora, Canada", 49.7670, -94.4894), ("Calgary, Canada", 51.0447, -114.0719),
    ("St. John's, Canada", 47.5615, -52.7126), ("Gander, Canada", 48.9569, -54.6089),
    # United States
    ("New York, USA", 40.7128, -74.0060), ("Newark, USA", 40.7357, -74.1724),
    ("Philadelphia, USA", 39.9526, -75.1652), ("Washington DC, USA", 38.9072, -77.0369),
    ("Baltimore, USA", 39.2904, -76.6122), ("Richmond, USA", 37.5407, -77.4360),
    ("Norfolk, USA", 36.8508, -76.2859), ("Cleveland, USA", 41.4993, -81.6944),
    ("Akron, USA", 41.0814, -81.5190), ("Pittsburgh, USA", 40.4406, -79.9959),
    ("Erie, USA", 42.1292, -80.0851), ("Buffalo, USA", 42.8864, -78.8784),
    ("Detroit, USA", 42.3314, -83.0458), ("Toledo, USA", 41.6528, -83.5379),
    ("Columbus, USA", 39.9612, -82.9988), ("Cincinnati, USA", 39.1031, -84.5120),
    ("Lexington, USA", 38.0406, -84.5037), ("Chicago, USA", 41.8781, -87.6298),
    ("Rockford, USA", 42.2711, -89.0940), ("Albany, USA", 42.6526, -73.7562),
    ("Boston, USA", 42.3601, -71.0589), ("Atlanta, USA", 33.7490, -84.3880),
    ("Tampa, USA", 27.9506, -82.4572), ("Charlotte, USA", 35.2271, -80.8431),
    ("Raleigh, USA", 35.7796, -78.6382), ("Knoxville, USA", 35.9606, -83.9207),
    ("San Francisco, USA", 37.7749, -122.4194), ("Los Angeles, USA", 34.0522, -118.2437),
    ("Seattle, USA", 47.6062, -122.3321),
    # United Kingdom
    ("London, UK", 51.5074, -0.1278), ("Birmingham, UK", 52.4862, -1.8904),
    ("Coventry, UK", 52.4068, -1.5197), ("Oxford, UK", 51.7520, -1.2577),
    ("Cambridge, UK", 52.2053, 0.1218), ("Manchester, UK", 53.4808, -2.2426),
    ("Carlisle, UK", 54.8925, -2.9329), ("Lancaster, UK", 54.0466, -2.8007),
    ("Glasgow, UK", 55.8642, -4.2518), ("Edinburgh, UK", 55.9533, -3.1883),
    # Asia / Pacific
    ("Dhaka, Bangladesh", 23.8103, 90.4125), ("Rangpur, Bangladesh", 25.7439, 89.2752),
    ("Rajshahi, Bangladesh", 24.3745, 88.6042), ("Sylhet, Bangladesh", 24.8949, 91.8687),
    ("Chittagong, Bangladesh", 22.3569, 91.7832), ("Comilla, Bangladesh", 23.4607, 91.1809),
    ("Bogra, Bangladesh", 24.8465, 89.3773), ("Singapore", 1.3521, 103.8198),
    ("Johor Bahru, Malaysia", 1.4927, 103.7414), ("Manado, Indonesia", 1.4748, 124.8421),
    ("Gorontalo, Indonesia", 0.5435, 123.0568), ("Jakarta, Indonesia", -6.2088, 106.8456),
    ("Delhi, India", 28.7041, 77.1025), ("Patna, India", 25.5941, 85.1376),
    ("Kolkata, India", 22.5726, 88.3639),
    # Africa (outside Nigeria)
    ("Kampala, Uganda", 0.3476, 32.5825), ("Jinja, Uganda", 0.4479, 33.2026),
    ("Nairobi, Kenya", -1.2921, 36.8219), ("Nakuru, Kenya", -0.3031, 36.0800),
    ("Dar es Salaam, Tanzania", -6.7924, 39.2083), ("Luanda, Angola", -8.8390, 13.2894),
    ("Accra, Ghana", 5.6037, -0.1870), ("Lome, Togo", 6.1725, 1.2314),
    ("Cotonou, Benin", 6.3703, 2.3912), ("Porto-Novo, Benin", 6.4969, 2.6289),
    ("Parakou, Benin", 9.3370, 2.6303), ("Niamey, Niger", 13.5116, 2.1254),
    ("Maradi, Niger", 13.5000, 7.1017), ("Zinder, Niger", 13.8072, 8.9881),
    ("Agadez, Niger", 16.9742, 7.9865), ("Diffa, Niger", 13.3154, 12.6113),
    ("Douala, Cameroon", 4.0511, 9.7679), ("Garoua, Cameroon", 9.3017, 13.3921),
    ("Maroua, Cameroon", 10.5910, 14.3159), ("N'Djamena, Chad", 12.1348, 15.0557),
    ("Malabo, Equatorial Guinea", 3.7504, 8.7371), ("Gulf of Guinea (at sea)", 3.0, 5.0),
    ("Atlantic Ocean off West Africa (0,0)", 0.0, 0.0),
    # South America / other
    ("Lima, Peru", -12.0464, -77.0428), ("Huancayo, Peru", -12.0651, -75.2049),
    ("Ica, Peru", -14.0678, -75.7286),
]


def nearest_place(lat, lon, max_km=400):
    best = min(PLACES, key=lambda p: haversine_km(lat, lon, p[1], p[2]))
    d = haversine_km(lat, lon, best[1], best[2])
    if d <= 25:
        return best[0]
    if d <= max_km:
        return f"{d:,.0f} km from {best[0]}"
    return f"({lat:.2f}, {lon:.2f}) - far outside Nigeria"
