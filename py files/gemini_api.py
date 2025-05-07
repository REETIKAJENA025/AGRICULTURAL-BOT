# gemini_api.py
import google.generativeai as genai
import requests
import json

# Hardcode API keys directly (move to config.py for production)
genai.configure(api_key="")  # Add your actual api key
OPENWEATHER_API_KEY = ""  # Add your actual api key

def get_weather_data(region):
    """Fetch current weather data using OpenWeatherMap API."""
    if region.lower() == "odisha":
        region = "Bhubaneswar"
    
    base_url = "http://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": region + ",IN",
        "appid": OPENWEATHER_API_KEY,
        "units": "metric"
    }
    try:
        response = requests.get(base_url, params=params)
        data = response.json()
        if data.get("cod") != 200:
            return f"Weather data unavailable for {region}: {data.get('message', 'Unknown error')}"
        weather = {
            "temp": data["main"]["temp"],
            "description": data["weather"][0]["description"],
            "humidity": data["main"]["humidity"],
            "wind_speed": data["wind"]["speed"]
        }
        return f"Current weather in {region}: {weather['temp']}°C, {weather['description']}, " \
               f"Humidity: {weather['humidity']}%, Wind: {weather['wind_speed']} m/s"
    except Exception as e:
        return f"Error fetching weather data: {str(e)}"

# Updated: Crop suggestions database with soil-based filtering
crop_suggestions = {
    "Odisha": {
        "monsoon": {"Alluvial": ["Rice", "Pulses"], "Laterite": ["Vegetables"]},
        "soil": "Alluvial",
        "planting_tips": {
            "Rice": "Plant rice in June-July with good water management.",
            "Pulses": "Sow pulses in July-August.",
            "Vegetables": "Plant vegetables in June with organic manure."
        }
    },
    "Punjab": {
        "monsoon": {"Alluvial": ["Wheat", "Rice"]},
        "soil": "Alluvial",
        "planting_tips": {
            "Wheat": "Sow wheat in November.",
            "Rice": "Plant rice in June."
        }
    },
    "Maharashtra": {
        "monsoon": {"Black": ["Cotton", "Sugarcane"]},
        "soil": "Black",
        "planting_tips": {
            "Cotton": "Cotton needs well-drained soil, plant in June.",
            "Sugarcane": "Plant sugarcane in July."
        }
    },
    "Tamil Nadu": {
        "monsoon": {"Red": ["Rice", "Pulses"]},
        "soil": "Red",
        "planting_tips": {
            "Rice": "Rice thrives in October monsoon.",
            "Pulses": "Sow pulses in November."
        }
    },
    "Rajasthan": {
        "monsoon": {"Sandy": ["Millets"]},
        "soil": "Sandy",
        "planting_tips": {
            "Millets": "Millets in July, drought-resistant."
        }
    },
    "Kerala": {
        "monsoon": {"Laterite": ["Spices", "Vegetables"]},
        "soil": "Laterite",
        "planting_tips": {
            "Spices": "Spices like turmeric in May-June.",
            "Vegetables": "Plant vegetables in June."
        }
    }
}

def get_gemini_response(query, region=None, language="en"):
    # Map language codes to full names for Gemini prompt
    language_map = {
        "en": "English",
        "od": "Odia",
        "hi": "Hindi",
        "ta": "Tamil",
        "pa": "Punjabi",
        "te": "Telugu",
        "ml": "Malayalam"
    }
    language_name = language_map.get(language, "English")

    # Check if the query explicitly mentions a region
    query_lower = query.lower()
    explicit_region = None
    for reg in crop_suggestions.keys():
        if reg.lower() in query_lower:
            explicit_region = reg
            break

    # Use explicit region if found; otherwise, use the region passed (default from account)
    effective_region = explicit_region if explicit_region else region

    system_prompt = f"""
    You are AgriBot, an agricultural advisory chatbot designed specifically for Indian farmers. Your responses should be tailored to the Indian agricultural context, considering the following:
    - Common crops: Rice, wheat, maize, sugarcane, cotton, pulses (e.g., lentils, chickpeas), millets, spices (e.g., turmeric, chili), and vegetables.
    - Climate and regions: Diverse climates (tropical, subtropical, arid) across states like Punjab (wheat/rice, monsoon: June-September), Maharashtra (cotton/sugarcane, monsoon: June-October), Tamil Nadu (rice/pulses, monsoon: October-December), Rajasthan (millets, monsoon: July-September), and Kerala (spices/vegetables, monsoon: May-November).
    - Soil types: Alluvial (Ganges plain), black soil (Deccan), red soil (South India), laterite (coastal areas), and sandy soil (arid regions).
    - Pest and disease challenges: Common pests like locusts, aphids, bollworms, and diseases like blast in rice, wilt in pulses, and powdery mildew in vegetables.
    - Farming practices: Traditional methods, monsoon dependency, use of organic fertilizers (e.g., cow dung), and increasing adoption of modern techniques (drip irrigation, hybrid seeds).
    - Government schemes: Reference schemes like PM Kisan Samman Nidhi, Soil Health Card, or crop insurance where relevant.
    - Popular fertilizer brands: Urea (DAP by Coromandel, NPK by IFFCO, MOP by Tata Chemicals), organic options like Ammonium Sulphate, and local blends available through cooperatives.
    - Monsoon schedules: Vary by region (e.g., Punjab: June-September, Kerala: May-November); advise on planting and pest control based on these schedules.
    - Language and tone: Respond fully in {language_name} (language code: {language}), using simple, conversational language, avoiding jargon, and providing practical, actionable advice. Ensure all text, including weather data and crop prices, is in {language_name}.

    The user is from the region: {effective_region if effective_region else 'not specified'}. Tailor your response based on this region if provided, considering local crops, climate, monsoon schedules, and fertilizer recommendations. If the region is not specified or the query is vague, ask for clarification in {language_name}.

    **Crop Price Updates**: When the user asks about the price, rate, or cost of a crop (e.g., "What’s the price of wheat in Punjab?" or "गेहूं की कीमत क्या है?"), provide a realistic price estimate in rupees per quintal based on typical Indian mandi rates for that region and crop. Use the following mock data as a guide (invent plausible values if the crop/region isn’t listed):
    - Punjab: Wheat ₹2200/quintal, Rice ₹3000/quintal, Maize ₹1800/quintal
    - Maharashtra: Sugarcane ₹2500/quintal, Cotton ₹6000/quintal
    - Tamil Nadu: Rice ₹2800/quintal, Pulses ₹4500/quintal
    - Rajasthan: Millets ₹2000/quintal
    - Kerala: Spices ₹15000/quintal
    - Odisha: Rice ₹2700/quintal, Vegetables ₹3000/quintal
    Respond in {language_name} only.
    """

    try:
        model = genai.GenerativeModel("gemini-1.5-pro")
        chat = model.start_chat(history=[])
        chat.send_message(system_prompt)

        # Updated: Check for crop suggestion query with soil type
        if "which crops" in query_lower or "what crops" in query_lower:
            data = json.loads(query) if isinstance(query, str) and query.startswith('{') else {"query": query}
            soil_type = data.get('soil', None) or crop_suggestions.get(effective_region, {}).get("soil", "Alluvial")
            if effective_region and effective_region in crop_suggestions:
                crops = crop_suggestions[effective_region]["monsoon"].get(soil_type, crop_suggestions[effective_region]["monsoon"].get("Alluvial", ["Rice"]))
                tips = crop_suggestions[effective_region]["planting_tips"].get(crops[0], "Follow local planting practices.")
                response_text = f"For {effective_region} during the monsoon season with {soil_type} soil, consider growing: {', '.join(crops)}. {tips}"
            else:
                response_text = f"Please specify a valid region so I can suggest crops suitable for your area. Your account region is set to '{region}'."
            return response_text

        if effective_region:
            weather_info = get_weather_data(effective_region)
            full_query = f"{query}\n\nAdditional Info: {weather_info}"
        else:
            full_query = query

        response = chat.send_message(full_query)
        return response.text
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    print("Hindi:", get_gemini_response("ओडिशा में चावल की कीमत क्या है?", "Odisha", "hi"))
    print("Tamil:", get_gemini_response("ஒடிசாவில் அரிசியின் விலை என்ன?", "Odisha", "ta"))
