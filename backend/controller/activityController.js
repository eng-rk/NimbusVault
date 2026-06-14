const Activity = require("../models/Activity");

// 1. Get activity feed
const getActivities = async (req, res) => {
    try {
        const userId = req.user.id;

        // fetch
        const activities = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50); // limit to recent 50 activities

        // response
        res.status(200).json({
            msg: "Activities fetched successfully",
            data: activities
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "Server error" });
    }
};

module.exports = {
    getActivities
};
