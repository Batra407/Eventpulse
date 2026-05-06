 EventPulse 📊

![EventPulse Banner](./frontend/assets/logo.png) <!-- Replace with a real screenshot/banner if you have one -->

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)]()

EventPulse is a complete, AI-powered event feedback and attendance tracking SaaS platform.

## 🚀 Introduction

Managing event attendance and collecting meaningful feedback is often a fragmented, manual, and time-consuming process. Organizers struggle with paper forms, disjointed spreadsheets, and low feedback response rates. 

**EventPulse solves this problem.** 

EventPulse provides a seamless, end-to-end solution for event organizers to:
1. Create and manage events.
2. Track attendance effortlessly using **dynamic QR codes**.
3. Collect real-time, public feedback via a beautifully designed form.
4. Analyze the success of their events using a powerful data dashboard with sentiment analysis.

This project was built to empower academic institutions, tech communities, and corporate event managers to focus on their events rather than administrative tracking.

---

## ✨ Features

- **📱 Dynamic QR Code Attendance:** Generates unique QR codes for every event that attendees can scan with their smartphones to mark their presence instantly.
- **📝 Seamless Feedback Collection:** A frictionless, public-facing feedback form (no login required for attendees) featuring a star rating, NPS score, and tags.
- **📊 Real-time Analytics Dashboard:** A comprehensive organizer dashboard showing total attendees, total responses, average ratings, and Net Promoter Score (NPS).
- **🤖 AI-Powered Sentiment Analysis:** Automatically analyzes text feedback to gauge attendee sentiment (Positive, Neutral, Negative). *(Note: Requires AI integration)*
- **🔒 Secure Organizer Authentication:** Robust JWT-based authentication with HttpOnly cookies to keep organizer data secure.
- **📥 Data Export:** Export attendance and feedback data easily for external reporting.
- **🎨 Beautiful UI/UX:** Responsive, modern design with GSAP animations for a premium user experience.

---

## ⚙️ How It Works

### The Workflow:
1. **Event Creation:** An approved Organizer logs into the dashboard and creates a new event.
2. **QR Generation:** The backend automatically generates a secure, 30-day expiring JWT token and embeds it into a scannable QR Code URL pointing to the production domain.
3. **Event Day (Scanning):** The organizer displays the QR code. Attendees scan it with their phones, which opens the attendance form.
4. **Attendance Marking:** Attendees submit their name (and optional email). The system records their attendance instantly.
5. **Feedback:** After the event, attendees can visit the feedback link to rate the event, provide an NPS score, and leave comments.
6. **Analytics:** The Organizer views real-time statistics and reads feedback directly on their dashboard.

### Architecture Flow:
- **Frontend:** Pure HTML/CSS/Vanilla JS communicating with the backend via RESTful APIs (`fetch`).
- **Backend:** Express.js REST API handling routing, validation, business logic, and database interactions.
- **Database:** MongoDB Atlas storing structured data for Users, Events, Attendance, and Feedback.

---

## 🛠️ Technologies Used

### Frontend
- **HTML5 & CSS3** (Custom styling, no heavy CSS frameworks)
- **Vanilla JavaScript** (ES6+)
- **GSAP** (GreenSock Animation Platform for smooth UI animations)

### Backend
- **Node.js** (Runtime environment)
- **Express.js** (Web framework)
- **MongoDB** (NoSQL Database)

### Security & Authentication
- **JWT (JSON Web Tokens)** (Dual token system: Access + Refresh)
- **bcryptjs** (Password hashing)
- **Helmet.js** (HTTP security headers)
- **Express Rate Limit** (Brute-force protection)
- **Express Mongo Sanitize** (NoSQL injection prevention)

### Deployment
- **Vercel** (Serverless backend & static frontend hosting)
- **MongoDB Atlas** (Cloud Database)

---

## 📦 Libraries & Packages Used

Here are the core dependencies powering EventPulse:

- `express` → Fast, unopinionated, minimalist web framework.
- `mongoose` → Elegant MongoDB object modeling.
- `jsonwebtoken` → Secure, stateless authentication.
- `bcryptjs` → Cryptographic password hashing.
- `zod` → TypeScript-first schema declaration and validation.
- `cors` → Cross-Origin Resource Sharing middleware.
- `dotenv` → Environment variable management.
- `cookie-parser` → Parsing HTTP request cookies securely.
- `helmet` → Securing Express apps by setting HTTP response headers.
- `nodemailer` → Sending transactional emails.
- `express-rate-limit` → Basic rate-limiting middleware.

---

## 🧰 Tools Used

- **VS Code:** IDE for development.
- **Git & GitHub:** Version control and collaboration.
- **Postman:** API testing and endpoint verification.
- **MongoDB Atlas:** Cloud database management.
- **Vercel:** Production hosting and CI/CD.

---

## 💻 Installation Guide

Follow these steps to run EventPulse locally on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB Atlas Account](https://www.mongodb.com/atlas/database) (or local MongoDB)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/Batra407/Eventpulse.git
cd Eventpulse
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory by copying the example file:
```bash
cp .env.example .env
```
Open `.env` and fill in your details:
```env
PORT=5000
NODE_ENV=development

# Add your MongoDB Atlas Connection String here:
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.../eventpulse?retryWrites=true&w=majority

# Generate random strings for these:
JWT_SECRET=your_super_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Add your Vercel URL (or localhost for dev)
FRONTEND_URL=http://localhost:5000
```

### 4. Run the application
Start the development server with hot-reloading:
```bash
npm run dev
```
The server will start on `http://localhost:5000`. 
Open `http://localhost:5000` in your browser to view the application!

*(Note: New organizer registrations are set to auto-approve for testing purposes.)*

---

## 📸 Screenshots

*(Replace these placeholder links with actual paths to your screenshots)*

| Landing Page | Dashboard Analytics |
|:---:|:---:|
| ![Landing Page Placeholder](https://via.placeholder.com/400x250.png?text=Landing+Page) | ![Dashboard Placeholder](https://via.placeholder.com/400x250.png?text=Dashboard) |

| QR Scanner | Feedback Form |
|:---:|:---:|
| ![Scanner Placeholder](https://via.placeholder.com/400x250.png?text=QR+Scanner) | ![Feedback Placeholder](https://via.placeholder.com/400x250.png?text=Feedback+Form) |

---

## 🚀 Future Improvements

- **AI Integration:** Fully activate the AI worker for automated sentiment analysis and event summarization.
- **Email Notifications:** Implement automated email summaries to organizers using Nodemailer after an event concludes.
- **Attendee Dashboard:** Create a portal for attendees to view their past event history.
- **Custom Branding:** Allow organizers to customize the colors and logo of their specific event feedback forms.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
Feel free to check the [issues page](https://github.com/Batra407/Eventpulse/issues) if you want to contribute.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 👨‍💻 Author Information

**Ansh Batra**
- GitHub: [@Batra407](https://github.com/Batra407)

---
*If you like this project, please consider giving it a ⭐ on GitHub!*
