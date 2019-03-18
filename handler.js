"use strict";

const aws = require("aws-sdk");
const iam = new aws.IAM();
const sns = new aws.SNS({ apiVersion: "2010-03-31" });

const DEBUG = !(process.env.DEBUG.toLowerCase() == "false");

const LOG_STRING = !(process.env.LOG.toLowerCase() == "false");
const log = string => {
  if (LOG_STRING) console.log(string);
};

let getDate = stringDate => {
  const returnDate = new Date(stringDate);
  returnDate.setHours(0, 0, 0, 0);
  return returnDate;
};

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const VALIDATION_DATE = new Date();
VALIDATION_DATE.setDate(TODAY.getDate() - process.env.DAYS_VALID);
VALIDATION_DATE.setHours(0, 0, 0, 0);

const WARNING_DATE = new Date();
WARNING_DATE.setDate(
  TODAY.getDate() -
    process.env.DAYS_VALID +
    parseInt(process.env.DAYS_FOR_WARNING, 10)
);
WARNING_DATE.setHours(0, 0, 0, 0);

/**
 *
 * Return array of AWS User objects
 *
 */
let getUsers = () => {
  return iam
    .listUsers({})
    .promise()
    .then(data => {
      return Promise.all(data.Users);
    })
    .catch(err => {
      console.log(err.stack);
      return Promise.all([]);
    });
};

/**
 * Given an array of AWS User objects add user associated
 * access key array to it and return new User object array
 *
 */
let attachAccessKeys = users => {
  return Promise.all(
    users.map(user =>
      iam
        .listAccessKeys({ UserName: user.UserName })
        .promise()
        .then(data => {
          user.accessKeys = data;
          return user;
        })
    )
  ).then(data => {
    return users;
  });
};

let logAcessKeyDebugInformation = accessKey => {
  const testDate = new Date(accessKey.CreateDate);
  console.log("----------------------------");
  console.log(accessKey);
  console.log("User                           : " + accessKey.UserName);
  console.log("Access Key Id                  : " + accessKey.AccessKeyId);
  console.log("Access key create date         : " + testDate);
  console.log("Days Valid                     : " + process.env.DAYS_VALID);
  console.log(
    "Days To Warn                   : " + process.env.DAYS_FOR_WARNING
  );
  console.log("TODAY                          : " + TODAY);
  console.log("EXPIRATION_DATE                : " + VALIDATION_DATE);
  console.log("WARNING_DATE                   : " + WARNING_DATE);
  console.log(
    "Expiration date <= Create Date : " + (+VALIDATION_DATE <= +testDate)
  );
  console.log(
    "Create Date < Warning Date     : " + (+testDate < +WARNING_DATE)
  );
  console.log("----------------------------");
};

/**
 * Get access keys from User object and add a new boolean property
 * 'valid' to the access key oject based whether the create date
 * is older than the current date.
 */

let validateAccessKeys = users => {
  return Promise.all(
    users.map(user => {
      return Promise.all(
        user.accessKeys.AccessKeyMetadata.map(accessKey => {
          let testDate = getDate(accessKey.CreateDate);
          if (DEBUG) logAcessKeyDebugInformation(accessKey);
          accessKey.valid = +VALIDATION_DATE < +testDate;
          accessKey.warning =
            +VALIDATION_DATE <= +testDate && +testDate < +WARNING_DATE;
          accessKey.expirationDate = new Date();
          accessKey.expirationDate.setDate(
            testDate.getDate() + parseInt(process.env.DAYS_VALID)
          );
          accessKey.expirationDate.setHours(0, 0, 0, 0);
          return accessKey;
        })
      );
      // return user;
    })
  ).then(data => {
    return users;
  });
};

/**
 * log users and access keys that are close to being invalid
 *
 * @param {*} users
 */
let logValidationIssues = users => {
  users.messagesInvalid = [];
  users.forEach(user => {
    user.accessKeys.AccessKeyMetadata.forEach(accessKey => {
      if (!accessKey.valid) {
        log(
          process.env.LOG_PREPEND_ISSUE_NOTIFIER +
            ":" +
            user.UserName +
            " has old key (" +
            accessKey.AccessKeyId +
            ") with create date:" +
            accessKey.CreateDate
        );
        users.messagesInvalid.push(
          process.env.LOG_PREPEND_ISSUE_NOTIFIER +
            ":" +
            user.UserName +
            " has old key (" +
            accessKey.AccessKeyId +
            ") with create date:" +
            accessKey.CreateDate
        );
      }
    });
  });
  return users;
};

/**
 * log users and access keys that are close to being invalid
 *
 * @param {*} users
 */
let logWarningIssues = users => {
  users.messagesWarning = [];
  users.forEach(user => {
    user.accessKeys.AccessKeyMetadata.forEach(accessKey => {
      if (accessKey.warning) {
        log(
          process.env.LOG_PREPEND_WARNING_NOTIFIER +
            ":" +
            user.UserName +
            " has access key (" +
            accessKey.AccessKeyId +
            ") expires on " +
            accessKey.expirationDate +
            ". Create date:" +
            accessKey.CreateDate
        );
        users.messagesWarning.push(
          process.env.LOG_PREPEND_WARNING_NOTIFIER +
            ":" +
            user.UserName +
            " has access key (" +
            accessKey.AccessKeyId +
            ") expires on " +
            accessKey.expirationDate +
            ". Create date:" +
            accessKey.CreateDate
        );
      }
    });
  });
  return users;
};
/**
 *
 * @param {*} data
 */
let publishSNSMessage = users => {
  if (users.messagesInvalid.length > 0 || users.messagesWarning.length > 0) {
    const params = {
      Message: JSON.stringify(
        [].concat(users.messagesWarning).concat(users.messagesInvalid)
      ),
      Subject: process.env.SNS_SUBJECT,
      TopicArn: process.env.SNS_TOPICARN
    };
    return sns.publish(params).promise();
  }
  return users;
};

// AWS Lambda handler
module.exports.validate = (event, context, callback) => {
  getUsers()
    .then(attachAccessKeys)
    .then(validateAccessKeys)
    .then(logWarningIssues)
    .then(logValidationIssues)
    .then(publishSNSMessage)
    .then(data => {
      const response = {
        statusCode: 200,
        body: JSON.stringify("Finished function to check rotating keys!")
      };
      console.log(response);
      return response;
    })
    .catch(err => {
      console.log(err);
      const response = {
        statusCode: 500,
        body: JSON.stringify(
          "Error on function to check rotating keys!:" + err.message
        )
      };
      return response;
    });
};
