require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();

// Render ক্লাউড সার্ভারের জন্য Dynamic Port নির্ধারণ
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ================= মেমোরি ডাটাবেস =================
let otpStore = {};     
let userStore = {};    
let resetOtpStore = {};

// ================= NODEMAILER CONFIGURATION =================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'tanjifacademy@gmail.com', 
        pass: process.env.EMAIL_PASS || 'zqvdxhtkehbrpxsq' 
    }
});

// গুগল শিটের বদলে সহজে সার্ভারে ডাটা সেভ করার ফাংশন
async function saveToGoogleSheet(name, tanzifID, phone, email, date) {
    try {
        const userData = `${date}, ${name}, ${tanzifID}, ${phone}, ${email}\n`;
        fs.appendFileSync('registered_users.txt', userData, 'utf8');
        console.log(`💾 [Local File Saved] -> ডাটা সফলভাবে ফাইলে সেভ হয়েছে: ${name}`);
    } catch (error) {
        console.error("❌ ফাইল সেভ করতে সমস্যা হয়েছে:", error);
    }
}

// ================= ১. ওটিপি জেনারেশন ও ইমেইল প্রেরণ API =================
app.post('/api/send-otp', async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        if (!name || !phone || !email) {
            return res.status(400).json({ success: false, message: "সব তথ্য প্রদান করুন।" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        otpStore[email] = { name, phone, otp };

        const mailOptions = {
            from: process.env.EMAIL_USER || 'tanjifacademy@gmail.com',
            to: email,
            subject: 'Tanjif Academy - Registration OTP',
            text: `প্রিয় ${name},\n\nতানজিফ একাডেমিতে নিবন্ধনের জন্য আপনার ওটিপি কোডটি হলো: ${otp}\n\nধন্যবাদ,\nতানজিফ একাডেমি টিম`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("Mail Send Error: ", error);
        });

        console.log(`🔑 OTP Generated for ${email} -> ${otp}`);
        return res.json({ success: true, message: "ওটিপি মেইলে পাঠানো হয়েছে।" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "সার্ভারে সমস্যা হয়েছে।" });
    }
});

// ================= ২. ওটিপি ভেরিফিকেশন ও পাসওয়ার্ড হ্যাশিং (নিবন্ধন সম্পন্ন) =================
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp, password } = req.body;

        if (!email || !otp || !password) {
            return res.status(400).json({ success: false, message: "সব তথ্য পূরণ করুন।" });
        }

        if (!otpStore[email] || otpStore[email].otp !== otp) {
            return res.status(400).json({ success: false, message: "ভুল বা অকার্যকর ওটিপি!" });
        }

        const userData = otpStore[email];
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const randomNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const tanzifID = `TA-${randomNumber}`;
        const regDate = new Date().toISOString().split('T')[0];

        userStore[email] = {
            name: userData.name,
            phone: userData.phone,
            password: hashedPassword,
            tanzifID: tanzifID,
            createdAt: regDate
        };

        delete otpStore[email];

        await saveToGoogleSheet(userData.name, tanzifID, userData.phone, email, regDate);

        return res.json({
            success: true,
            name: userData.name,
            tanzifID: tanzifID,
            message: "নিবন্ধন সফল হয়েছে!"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "ভেরিফিকেশনে ত্রুটি হয়েছে।" });
    }
});

// ================= ৩. পাসওয়ার্ড ভুলে গেলে রিসেটের ব্যবস্থা (ফিচার ২) =================
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if(!userStore[email]) {
        return res.status(400).json({ success: false, message: 'এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি!' });
    }

    const resetOtp = Math.floor(1000 + Math.random() * 9000).toString();
    resetOtpStore[email] = resetOtp;

    const mailOptions = {
        from: process.env.EMAIL_USER || 'tanjifacademy@gmail.com',
        to: email,
        subject: 'Tanjif Academy - Password Reset OTP',
        text: `আপনার পাসওয়ার্ড রিসেট করার ওটিপি কোডটি হলো: ${resetOtp}`
    };

    transporter.sendMail(mailOptions, (err) => {
        if(err) console.log(err);
    });

    return res.json({ success: true, message: 'রিসেট ওটিপি পাঠানো হয়েছে।' });
});

app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if(!resetOtpStore[email] || resetOtpStore[email] !== otp) {
        return res.status(400).json({ success: false, message: 'ভুল ওটিপি কোড।' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    userStore[email].password = hashedPassword;
    delete resetOtpStore[email];

    return res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।' });
});

// ================= ৪. সঠিক তথ্য দিয়ে সিকিউরড লগইন API (ফিচার ১০) =================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        let targetUser = userStore[email];
        let targetEmail = email;

        if (!targetUser) {
            const foundEmail = Object.keys(userStore).find(key => userStore[key].tanzifID === email);
            if (foundEmail) {
                targetUser = userStore[foundEmail];
                targetEmail = foundEmail;
            }
        }

        if (!targetUser) {
            return res.status(400).json({ success: false, message: "অ্যাকাউন্ট পাওয়া যায়নি বা ভুল তথ্য!" });
        }

        const match = await bcrypt.compare(password, targetUser.password);
        if (!match) {
            return res.status(400).json({ success: false, message: "ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।" });
        }

        return res.json({
            success: true,
            name: targetUser.name,
            email: targetEmail,
            tanzifID: targetUser.tanzifID
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "লগইন প্রসেসে সার্ভার ত্রুটি।" });
    }
});

// ================= ৫. কন্টাক্ট মেসেজ ও অটো-ধন্যবাদ মেইল প্রেরণ (ফিচার ১৩) =================
app.post('/api/contact', async (req, res) => {
    try {
        const { email, message } = req.body;
        console.log(`✉️ New Message from ${email}: ${message}`);

        const senderEmail = process.env.EMAIL_USER || 'tanjifacademy@gmail.com';

        const adminMailOptions = {
            from: senderEmail,
            to: senderEmail,
            subject: 'New User Feedback/Message',
            text: `Sender: ${email}\nMessage: ${message}`
        };
        transporter.sendMail(adminMailOptions);

        const thanksMailOptions = {
            from: senderEmail,
            to: email,
            subject: 'তানজিফ একাডেমি - বার্তা প্রেরণের জন্য ধন্যবাদ',
            text: `প্রিয় সুধী,\n\nতানজিফ একাডেমিতে আপনার গুরুত্বপূর্ণ মতামত বা বার্তাটি পাঠানোর জন্য আপনাকে অসংখ্য ধন্যবাদ। আমাদের সাপোর্ট টিম খুব দ্রুত আপনার সাথে যোগাযোগ করবে।\n\nশুভেচ্ছা,\nতানজিফ একাডেমি`
        };
        transporter.sendMail(thanksMailOptions);

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false });
    }
});

// ================= হোম রুট ও সার্ভার স্টার্ট =================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 তানজিফ একাডেমি সিকিউরড সার্ভার চালু হয়েছে: http://localhost:${PORT}`);
});