# UrbanPulse 🌆

UrbanPulse is an advanced AI-driven civic engagement platform designed to bridge the gap between citizens and urban administration. It leverages cutting-edge AI technologies to streamline issue reporting, verify complaints through social signals, and provide predictive insights for environmental impact.

## 🚀 Key Features

- **Multi-Modal Reporting**: Submit complaints via text, images, or voice (powered by **Sarvam AI**).
- **AI Image Analysis**: Automated classification and validation of civic issues using **Roboflow** and **OpenAI GPT-4 Vision**.
- **Social Corroboration**: Cross-verifies reports with real-time social signals from **X (Twitter)** to filter noise and prioritize urgent issues.
- **Predictive Environmental Impact**: Uses **Google Gemini** to analyze reported issues and predict long-term environmental degradation and risks.
- **Emotion Analysis**: Analyzes the sentiment and urgency of reports using a custom **DistilBERT** model.
- **Interactive Dashboards**: Modern, real-time dashboards for both citizens and administrators.
- **Volunteer Network**: A rotary volunteer system that gamifies civic action with leaderboards and multi-language support.
- **Global Transparency**: Publicly accessible records of complaint statuses and administrative actions.

## 📁 Project Structure

The repository is divided into two main components:

### [1. CIVIC-REZO-Backend](./CIVIC-REZO-Backend)
A robust Node.js/Express backend that handles:
- AI service integrations (Gemini, Sarvam, Roboflow, OpenAI).
- Database management via **Supabase**.
- Python-based microservices for specialized tasks like GradCAM visualization and emotion analysis.
- Social media signal processing.

### [2. CIVIC-REZO-Frontend](./CIVIC-REZO-Frontend)
A cross-platform mobile application built with **Expo (React Native)** featuring:
- Seamless multi-step complaint submission.
- Real-time maps and location-based priority queues.
- In-app chatbot for civic assistance.
- Multi-language support (i18n).

## 🛠️ Getting Started

### Prerequisites
- Node.js (v16+)
- Expo CLI
- Python 3.8+ (for backend services)
- Supabase account

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/finstein-hackathon-org-2026/UrbanPulse.git
   cd UrbanPulse
   ```

2. **Setup Backend**:
   ```bash
   cd CIVIC-REZO-Backend
   npm install
   # Copy .env.example to .env and fill in your API keys
   cp .env.example .env
   npm start
   ```

3. **Setup Frontend**:
   ```bash
   cd CIVIC-REZO-Frontend
   npm install
   npx expo start
   ```

## 📄 Documentation

- [Backend Deployment Guide](./CIVIC-REZO-Backend/DEPLOYMENT.md)
- [Performance Optimizations](./CIVIC-REZO-Backend/PERFORMANCE_OPTIMIZATIONS.md)

## 🏆 Hackathon Context

This project was developed for the **Finstein Hackathon 2026**. It aims to revolutionize how modern cities handle infrastructure and environmental challenges through AI-augmented transparency and community action.
