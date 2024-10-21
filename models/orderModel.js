const db = require('../config/db')

const Order = function (order) {
    this.sender_id = order.sender_id
    this.file_name = order.file_name
    this.city = order.city
    this.upload_status = order.upload_status
}

// Insert order log into the database
Order.create = (newOrder, result) => {
    db.query('INSERT INTO orders SET ?', newOrder, (err, res) => {
        if (err) {
            console.log('Error: ', err)
            result(err, null)
            return
        }
        result(null, { id: res.insertId, ...newOrder })
    })
}

module.exports = Order
