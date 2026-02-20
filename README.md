# Smart Dashboard: Parking and Traffic in Seattle

This project is a smart dashboard built from the Lab template (Mapbox + C3.js). The goal is to help people explore how parking availability and cost might relate to traffic conditions in Seattle, and to make it easy to compare different parts of the city through an interactive map and linked charts. :contentReference[oaicite:1]{index=1}

## Live dashboard
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/

## What this dashboard shows
This dashboard focuses on a practical Seattle mobility question: where can drivers park, and what does traffic look like around those locations? It is designed for people who drive into the city but may want to park and then switch to transit—especially for busy destinations (downtown, events, game days, etc.). :contentReference[oaicite:2]{index=2}

On the map, you can:
- view parking facilities (garages and lots) and inspect their attributes
- view traffic flow patterns and compare areas with heavier vs. lighter traffic
- use filters and the reset button to explore different conditions
- see the information panel update based on what you’re currently looking at on the map (viewport-based summary)

## Data sources
This project uses public Seattle geospatial datasets:

- **Public Garages and Parking Lots** (SeattleCityGIS Open Data) :contentReference[oaicite:3]{index=3}  
- **2022 Traffic Flow** (Seattle GeoData) :contentReference[oaicite:4]{index=4}  

These datasets give a foundation for mapping parking supply and traffic conditions, and they can be extended later with other mobility indicators (transit access, pricing, etc.). :contentReference[oaicite:5]{index=5}

## Map type choice (why proportional symbols)
I used a proportional symbol approach because the parking dataset is made of discrete facilities (points). Proportional symbols let me show two things at once: *where* the facilities are and *how large/important* they are based on a numeric attribute (for example capacity, price level, or another proxy). Compared with a choropleth map, this avoids implying that values are evenly distributed across an entire neighborhood polygon when the phenomenon is actually tied to specific locations.

## Visualization components (at least two beyond the map)
This dashboard includes multiple linked components so the map is not “just a map”:

1. **Dynamic KPI cards** in the right panel  
   These summarize what’s currently visible on screen (for example: number of parking facilities in view, total capacity in view, and a traffic summary indicator).

2. **A time/summary chart (C3.js)**  
   The chart helps compare patterns instead of forcing the user to click point-by-point. Depending on the dataset, it can show traffic counts over time, or a distribution summary such as traffic volume by road class / parking facilities by type.

(Plus the dashboard also includes a legend, interactive popups, and reset/filter controls to support exploration.)

## How to run locally
Because this is a static web project, you can run it with any simple local server.

Example (VS Code Live Server or Python):
- `python -m http.server 8000`
- open `http://localhost:8000`

## How to deploy (GitHub Pages)
This repo is deployed via GitHub Pages so it can be accessed as:
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/
