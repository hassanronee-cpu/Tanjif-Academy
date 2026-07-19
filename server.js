const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 5000;

// মিডলওয়্যার
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ================= মেমোরি ডাটাবেস =================
let otpStore = {};     // { email: { name, phone, otp } }
let userStore = {};    // { email: { name, phone, password, tanzifID } }

// ================= ১. ওটিপি জেনারেশন API =================
app.post('/api/send-otp', async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        // ভ্যালিডেশন
        if (!name || !phone || !email) {
            return res.status(400).json({ 
                success: false, 
                message: "নাম, মোবাইল ও ইমেইল সব তথ্য প্রদান করুন।" 
            });
        }

        // ৪ ডিজিটের র্যান্ডম ওটিপি
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // মেমোরিতে সংরক্ষণ
        otpStore[email] = { name, phone, otp };

        // ====== CMD / টার্মিনালে OTP প্রিন্ট ======
        console.log('\n' + '='.repeat(50));
        console.log(' 🔔 তানজিফ একাডেমি - নতুন ওটিপি কোড');
        console.log('-'.repeat(50));
        console.log(` 👤 নাম      : ${name}`);
        console.log(` 📧 ইমেইল    : ${email}`);
        console.log(` 📱 মোবাইল   : ${phone}`);
        console.log(` 🔑 ওটিপি    : ${otp}`);
        console.log('='.repeat(50) + '\n');

        // ফ্রন্টএন্ডে সফল রেসপন্স
        return res.json({ 
            success: true, 
            message: "ওটিপি সফলভাবে তৈরি হয়েছে। আপনার টার্মিনাল/CMD চেক করুন।",
            otp: otp // ডেভেলপমেন্টের জন্য, প্রোডাকশনে সরিয়ে ফেলবেন
        });

    } catch (error) {
        console.error("OTP Generation Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "সার্ভারে সমস্যা হয়েছে।" 
        });
    }
});

// ================= ২. ওটিপি ভেরিফিকেশন API =================
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp, password } = req.body;

        // ভ্যালিডেশন
        if (!email || !otp || !password) {
            return res.status(400).json({
                success: false,
                message: "ইমেইল, ওটিপি ও পাসওয়ার্ড প্রদান করুন।"
            });
        }

        // ওটিপি ম্যাচিং চেক
        if (!otpStore[email]) {
            return res.status(400).json({
                success: false,
                message: "এই ইমেইলের জন্য ওটিপি পাওয়া যায়নি। আবার OTP পাঠান।"
            });
        }

        if (otpStore[email].otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "ভুল ওটিপি কোড! আবার চেষ্টা করুন।"
            });
        }

        // ওটিপি ম্যাচ করেছে - ইউজার তৈরি
        const userData = otpStore[email];
        
        // ১০ ডিজিটের র্যান্ডম মেম্বারশিপ আইডি
        const randomNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const tanzifID = `TA-${randomNumber}`;

        // পার্মানেন্ট ইউজার স্টোরে সেভ
        userStore[email] = {
            name: userData.name,
            phone: userData.phone,
            password: password,
            tanzifID: tanzifID,
            createdAt: new Date().toISOString()
        };

        // ওটিপি মেমোরি থেকে ডিলিট
        delete otpStore[email];

        // সাফল্যের লগ
        console.log(`\n✅ রেজিস্ট্রেশন সফল: ${userData.name} (${tanzifID})`);
        console.log(`📧 ইমেইল: ${email}\n`);

        // ফ্রন্টএন্ডে রেসপন্স
        return res.json({
            success: true,
            name: userData.name,
            tanzifID: tanzifID,
            message: "নিবন্ধন সফল হয়েছে!"
        });

    } catch (error) {
        console.error("Verification Error:", error);
        return res.status(500).json({
            success: false,
            message: "ভেরিফিকেশনে ত্রুটি হয়েছে।"
        });
    }
});

// ================= ৩. ইউজার লিস্ট (ডেভেলপমেন্ট হেল্পার) =================
app.get('/api/users', (req, res) => {
    const users = Object.keys(userStore).map(email => ({
        email,
        ...userStore[email],
        password: '🔒 হিডেন'
    }));
    res.json({ users });
});

// ================= ৪. হোম পেজ রুট =================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ================= সার্ভার স্টার্ট =================
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log(`🚀 তানজিফ একাডেমি সার্ভার চালু হয়েছে!`);
    console.log(`📍 লোকালহোস্ট: http://localhost:${PORT}`);
    console.log(`📝 ওটিপি কোড CMD/টার্মিনালে দেখাবে`);
    console.log('='.repeat(50) + '\n');
});