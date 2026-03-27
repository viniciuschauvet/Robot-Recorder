# 🤖 Robot Recorder

**Robot Recorder** is a powerful Chrome extension designed to simplify automated testing by recording your browser interactions and converting them into clean, production-ready test scripts.

## 🚀 Overview
Whether you are a QA engineer, a developer, or someone looking to automate repetitive web tasks, Robot Recorder eliminates the need to manually write complex selectors and commands. Just click "Start", perform your actions, and "Export" your script.

## ✨ Key Features
- **Multi-Framework Support**: Generate scripts for **Cypress**, **Playwright** (using modern `getByRole`, `getByTestId` locators), and **Robot Framework** with a single click.
- **Smart Recording**: Automatically captures clicks, typing, and navigation.
- **Assertion Mode**: Easily verify that elements contain specific text by clicking on them.
- **Wait Mode**: Record "wait for element" commands to handle asynchronous loading.
- **Live Preview**: See your script being built in real-time as you interact with the page.
- **Edit on the Fly**: Remove unwanted steps directly from the live preview.
- **Dark/Light Mode**: A sleek, developer-focused UI that matches your environment.
- **Side Panel Integration**: Stays open as you navigate between tabs for a seamless recording experience.

## 🛠️ How to Use
1. **Open the Extension**: Click the Robot Recorder icon in your Chrome toolbar or side panel.
2. **Select Framework**: Choose your target testing framework (Cypress, Playwright, or Robot Framework).
3. **Start Recording**: Click the **Start** button. The recorder will automatically capture your initial page visit.
4. **Interact**: Perform the actions you want to test on the website.
5. **Add Checks**:
   - Use **Assert** to verify text on the page.
   - Use **Wait** to ensure an element is visible before proceeding.
6. **Stop & Export**: Click **Stop** when finished, then click **Export Script** to copy the full test code to your clipboard.

## 📦 Installation (Developer Mode)
1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension` folder.

## 📝 Technical Details
- **Manifest Version**: 3
- **Permissions**: `storage`, `activeTab`, `scripting`, `sidePanel`
- **Tech Stack**: Vanilla JavaScript, CSS, HTML (No external dependencies required).

---
*Built for speed, accuracy, and ease of use. Happy testing!* 🤖✨
