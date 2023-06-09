const dotenv = require('dotenv').config()
const asyncHandler = require('express-async-handler')
const Transaction = require('../models/transactionModel')
const axios = require('axios')
const User = require('../models/userModel')
const Package = require('../models/packageModel')
const DataPlan = require('../models/dataPlans')

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1; // Adding 1 to get a 1-based month
const currentHour = currentDate.getHours();
const currentMinutes = currentDate.getMinutes();

const purchaseAirtime = asyncHandler(async (req, res) => {
  const { network, phoneNumber, amount, transactionId } = req.body

  // validate data
  if (!network || !phoneNumber || !amount) {
    res.status(400)
    throw new Error('Please fill in all fields')
  }

  const CKuserId = process.env.CLUB_KONNECT_USER_ID
  const apiKey = process.env.CLUB_KONNECT_API_KEY
  const apiUrl = `${process.env.CLUB_KONNECT_AIRTIME_URI}?UserID=${CKuserId}&APIKey=${apiKey}&MobileNetwork=${network}&MobileNumber=${phoneNumber}&Amount=${amount}&RequestID=${transactionId}`

  // Make API request to ClubKonnect
  const response = await axios.post(apiUrl)

  const { status, data } = response

  // Check if the API request was successful
  if (status === 200) {
    let discountRate

    // Determine the discount rate based on the mobile network
    switch (network) {
      case '01':
        discountRate = 3.5
        break
      case '02':
        discountRate = 8
        break
      case '04':
        discountRate = 3.5
        break
      case '03':
        discountRate = 6.5
        break
      default:
        discountRate = 0
    }
    // Calculate the bonus amount (40% of the recharge card amount with discount)
    const bonusAmount = (amount * (discountRate / 100) * 0.4).toFixed(2)

    // Add the bonus amount to the user's balance
    const user = await User.findById(req.user.id)
    user.commissionBalance += Number(bonusAmount)
    await user.save()

    // Get the user's package details
    const userPackage = await Package.findById(user.package.ID)

    // Check if the package has transaction levels defined
    if (
      userPackage &&
      userPackage.transaction &&
      userPackage.transaction.transactionLevels > 0
    ) {
      const transactionLevels = userPackage.transaction.transactionLevels

      // Determine the bonus levels based on the user's package and referralBonusLevel
      const bonusLevels = Math.min(
        transactionLevels,
        userPackage.referralBonusLevel
      )

      // Traverse upline and calculate bonuses for each level
      let uplineUser = user
      for (let i = 0; i < bonusLevels; i++) {
        // Check if upline user exists
        if (!uplineUser.upline) {
          break // No more upline to calculate bonuses for
        }

        // Find upline user and update their balance with transaction profit
        const upline = await User.findById(uplineUser.upline.ID)
        if (upline) {
          const transactionProfit = Number(
            (amount * userPackage.transaction.transactionProfit) / 100
          ).toFixed(2)

          upline.commissionBalance += Number(transactionProfit)
          await upline.save()
        }

        // Move to the next upline user
        uplineUser = upline
      }
    }

    res.status(200).json({
      message: 'Recharge card purchased successfully',
      bonusAmount
    })
  } else {
    res.status(400).json({
      message: data,
      error: 'Failed to purchase recharge card'
    })
  }
})

const purchaseData = asyncHandler(async (req, res) => {
  const { network, networkPlan, phoneNumber, amount } = req.body

  console.log('network:', network)
  console.log('dataPlan:', networkPlan)
  console.log('phoneNumber:', phoneNumber)

  // Validate data
  if (!network || !phoneNumber || !networkPlan) {
    res.status(400)
    throw new Error('Please fill in all fields')
  }

  // // Find the data plan from the database
  // const dataPlanEntry = await DataPlan.findOne({
  //   networkPlan: network,
  //   'plans.productCode': dataPlan
  // })

  // Define the profit for each mobile network
  const matchingPlan = await DataPlan.findOne({
    "plans.productCode": networkPlan
  });
  console.log(matchingPlan)

  // Check if the requested plan is available
  if (!matchingPlan) {
    res.status(400);
    throw new Error("Selected Plan not available");
  }

  const plan = matchingPlan.plans.find((plan) => plan.productCode === networkPlan);
  const profit = plan.difference;

  // Check if the user has sufficient balance in their wallet
  if (req.user.walletBalance < amount) {
    return res.status(400).json({
      message: 'Insufficient wallet balance'
    });
  }

  // Calculate the bonus amount based on the profit
  const bonusAmount = (profit * 0.4).toFixed(2);
  const transactionId = req.user.username + `${currentYear}${currentMonth}${currentHour}${currentMinutes}`;

  // console.log('dataPlanEntry:', dataPlanEntry)

  // if (!dataPlanEntry) {
  //   res.status(400)
  //   throw new Error('Invalid data plan')
  // }

  // const selectedPlan = dataPlanEntry.plans.find(
  //   plan => plan.productCode === dataPlan
  // )

  // console.log('selectedPlan:', selectedPlan)

  // if (!selectedPlan) {
  //   res.status(400)
  //   throw new Error('Invalid data plan')
  // }

  // const { productAmount, productName } = selectedPlan

  // console.log('productAmount:', productAmount)
  // console.log('productName:', productName)

  // Simulate dummy API response
  const dummyApiResponse = {
    statuscode: 200 // Simulate a successful transaction
    // Add other properties if needed
  }

  console.log('dummyApiResponse:', dummyApiResponse)

  // Check if the dummy API transaction was successful
  if (dummyApiResponse.statuscode === 200) {
    // Retrieve the user from the database
    const user = await User.findById(req.user.id)
    console.log('user:', user)
    if (!user) {
      res.status(400)
      throw new Error('User not found')
    }

    // Check if the user's balance is sufficient
    if (user.walletBalance < productAmount) {
      res.status(400)
      throw new Error('Insufficient balance')
    }

    // Deduct the product price from the user's balance
    user.walletBalance -= amount
    // Get the user's package transaction level and percentage
    const userPackage = await Package.findOne({ _id: user.package.ID })
    console.log('userPackage:', userPackage)
    const userTransactionLevel = userPackage.transaction.level
    const userTransactionPercentage = user.userTransactionPercent

    console.log('userTransactionLevel:', userTransactionLevel)
    console.log('userTransactionPercentage:', userTransactionPercentage)

    // // Calculate the bonus amount based on the product amount and transaction percentage
    // const bonusAmount = (
    //   (amount * userTransactionPercentage) /
    //   100
    // ).toFixed(2)

    // Add the bonus amount to the user's balance
    user.commissionBalance += Number(bonusAmount)
    await user.save()
    console.log('bonusAmount:', bonusAmount)

    // Check if the package has transaction levels defined
    console.log(userPackage);
    console.log(userPackage.transaction);
    console.log(userPackage.transaction.level);
    if (userPackage && userPackage.transaction && userPackage.transaction.level > 0) {
      const transactionLevels = userPackage.transaction.level;

      // Determine the bonus levels based on the user's package and referralBonusLevel
      const bonusLevels = Math.min(
        transactionLevels,
        userPackage.referralBonusLevel
      );

      let uplineUser = user;
      for (let i = 1; i <= bonusLevels; i++) {
        // Check if upline user exists
        if (!uplineUser.upline) {
          break; // No more upline to calculate bonuses for
        }

        // Find upline user and update their balance with transaction profit
        const upline = await User.findById(uplineUser.upline.ID)
        if (upline) {
          // Check if the upline user is a basic user
          console.log(upline.package.name)
          if (upline.package.name === 'Basic' && i !== 1) {
            uplineUser = upline.upline;
            continue;
          }

          const uplinePercentage = await User.findById(uplineUser.upline.ID).populate({
            path: 'package.ID',
            select: 'transaction.percentage',
          });

          console.log(uplinePercentage.package.ID.transaction.percentage);
          const transactionProfit = Number(
            (profit * uplinePercentage.package.ID.transaction.percentage) / 100
          ).toFixed(2);
          console.log("Upline Tranaction Profit: ", transactionProfit);

          upline.commissionBalance += Number(transactionProfit);
          await upline.save();
        }

        uplineUser = upline; // Move to the next upline user
      }
    }


    // If the transaction is successful, create a new credit transaction record for the data purchase
    const transaction = new Transaction({
      user: req.user.id,
      amount: productAmount,
      transactionId: 'hello', // Replace with actual transaction ID
      transactionType: 'data',
      commission: bonusAmount,
      status: 'completed',
      dataPlan: productName,
      phoneNumber: phoneNumber,
      network: network
    })

    await transaction.save()

    res.status(200).json({
      message: 'Data plan purchased successfully',
      bonusAmount
    })
  } else {
    res.status(400).json({
      message: 'Failed to purchase data plan'
    })
  }
})

const walletTransfer = asyncHandler(async (req, res) => {
  const { senderUsername, recipientUsername, amount } = req.body

  try {
    // Find the sender user and update the wallet balance
    const senderUser = await User.findOneAndUpdate(
      { username: senderUsername },
      { $inc: { walletBalance: -amount } }, // Decrement the sender's balance
      { new: true } // Return the updated document
    )

    if (!senderUser) {
      return res.status(404).json({ error: 'Sender user not found.' })
    }

    // Check if the sender has sufficient balance
    if (senderUser.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance.' })
    }

    // Find the recipient user and update the wallet balance
    const recipientUser = await User.findOneAndUpdate(
      { username: recipientUsername },
      { $inc: { walletBalance: amount } }, // Increment the recipient's balance
      { new: true } // Return the updated document
    )

    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient user not found.' })
    }

    // Create a new credit transaction record for the transfer
    const creditTransaction = new Transaction({
      user: senderUser._id,
      transactionId: 'your_transaction_id', // Replace with actual transaction ID
      transactionType: 'transfer',
      transactionCategory: 'credit',
      commission: 0, // Set the commission value accordingly
      status: 'completed',
      amount: amount
    })

    await creditTransaction.save()

    // Create a new debit transaction record for the sender
    const debitTransaction = new Transaction({
      user: senderUser._id,
      transactionId: 'your_transaction_id', // Replace with actual transaction ID
      transactionType: 'transfer',
      transactionCategory: 'debit',
      commission: 0, // Set the commission value accordingly
      status: 'completed',
      amount: amount
    })

    await debitTransaction.save()

    res.json({ message: 'Funds transferred successfully.' })
  } catch (error) {
    res.status(500).json({ error: 'An error occurred.' })
  }
})

module.exports = {
  purchaseAirtime,
  purchaseData,
  walletTransfer
}
