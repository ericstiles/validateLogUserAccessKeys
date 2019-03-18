// In the Test
"use strict";
const AWS = require("aws-sdk");
const AWSMock = require("aws-sdk-mock");
const test = require("unit.js");
const rewire = require("rewire");
const assert = require('assert').strict;

const sampleEvent = {
  // ... sensitive data
};
const sampleContext = {
  // ... sensitive data
};

process.env.S3_BUCKET = "yourbucket.domain.com";
process.env.SNS_TOPIC_ERROR = "error::Arn";
process.env.SNS_TOPIC_SUCCESS = "Succees::Arn";
process.env.DAYS_FOR_WARNING = 10;
process.env.DAYS_VALID = 90;
process.env.DEBUG = "false";
process.env.LOG = "true";
process.env.LOG_PREPEND_ISSUE_NOTIFIER = "ACCESS KEY VALIDATION ISSUE";
process.env.LOG_PREPEND_WARNING_NOTIFIER = "ACCESS KEY VALIDATION WARNING";

AWSMock.setSDKInstance(AWS);
// AWSMock.setSDK(path.resolve('node_modules/aws-sdk'));

describe("Tests the methods to find Users, AccessKeys then log and warn on AccessKeys create date", function() {
  it("should get an array of Users", async () => {
    const dummyUsersResponse = {
      Users: [
        {
          Path: "/",
          UserName: "user",
          UserId: "AIDAI7A3M3AUYS4CJIUFM",
          Arn: "arn:aws:iam::827046125129:user/user",
          CreateDate: new Date("2019-01-26T02:35:19.000Z"),
          PasswordLastUsed: new Date("2019-01-26T03:06:00.000Z")
        }
      ]
    };

    try {
      AWSMock.mock("IAM", "listUsers", function(params, callback) {
        // console.log("------------- IAM.listUsers WORKS ------------");
        // console.log(params);
        callback(null, dummyUsersResponse);
      });
      const Handler = rewire("./handler.js");
      const getUsers = Handler.__get__("getUsers");
      return getUsers().then(data => {
        test.assert(data[0].UserName === dummyUsersResponse.Users[0].UserName);
        test.assert(data.length === 1);
      });
    } catch (error) {
      throw error;
    }
  });

  it("should attach array of AccessKeys to the associated User object", async () => {
    const dummyUsersResponse = {
      Users: [
        {
          Path: "/",
          UserName: "user",
          UserId: "AIDAI7A3M3AUYS4CJIUFM",
          Arn: "arn:aws:iam::827046125129:user/user",
          CreateDate: new Date("2019-01-26T02:35:19.000Z"),
          PasswordLastUsed: new Date("2019-01-26T03:06:00.000Z")
        }
      ]
    };
    const dummyAccessKeyResponse = {
      ResponseMetadata: { RequestId: "966b3928-2a20-11e9-b998-9f3964ebcb2b" },
      AccessKeyMetadata: [
        {
          UserName: "user",
          AccessKeyId: "AKIAJFNVEKKUJKY5DO4Q",
          Status: "Active",
          CreateDate: new Date("2019-01-10T14:30:10.000Z")
        }
      ],
      IsTruncated: false
    };
    try {
      AWSMock.mock("IAM", "listUsers", function(params, callback) {
        // console.log("------------- IAM.listUsers WORKS ------------");
        // console.log(params);
        callback(null, dummyUsersResponse);
      });
      AWSMock.mock("IAM", "listAccessKeys", function(params, callback) {
        // console.log("------------- IAM.listAccessKeys WORKS ------------");
        // console.log(params);
        callback(null, dummyAccessKeyResponse);
      });
      const Handler = rewire("./handler.js");
      const attachAccessKeys = Handler.__get__("attachAccessKeys");
      return attachAccessKeys(dummyUsersResponse.Users).then(data => {
        test.assert(data[0].accessKeys === dummyAccessKeyResponse);
        test.assert(data[0].accessKeys.AccessKeyMetadata.length === 1);
      });
    } catch (error) {
      throw error;
    }
  });

  it("should attach 'valid' boolean (false) to and 'warning' boolean (false) to AccessKey object", async () => {
    let mockUsersAccessKeyData = [
      {
        Path: "/",
        UserName: "user",
        UserId: "AIDAI7A3M3AUYS4CJIUFM",
        Arn: "arn:aws:iam::827046125129:user/user",
        CreateDate: new Date("2019-01-26T02:35:19.000Z"),
        PasswordLastUsed: new Date("2019-01-26T03:06:00.000Z"),
        accessKeys: {
          ResponseMetadata: {
            RequestId: "966b3928-2a20-11e9-b998-9f3964ebcb2b"
          },
          AccessKeyMetadata: [
            {
              UserName: "user",
              AccessKeyId: "AKIAJFNVEKKUJKY5DO4Q",
              Status: "Active",
              CreateDate: new Date("2019-02-10T14:30:10.000Z")
            }
          ],
          IsTruncated: false
        }
      }
    ];

    try {
      const Handler = rewire("./handler.js");
      const validateAccessKeys = Handler.__get__("validateAccessKeys");

      //Expect Key create date is older than valid date
      const accessKeyCreateDateOlderThanValid = new Date();
      accessKeyCreateDateOlderThanValid.setDate(
        accessKeyCreateDateOlderThanValid.getDate() -
          parseInt(process.env.DAYS_VALID) -
          1
      );
      mockUsersAccessKeyData[0].accessKeys.AccessKeyMetadata[0].CreateDate = accessKeyCreateDateOlderThanValid;
      return validateAccessKeys(mockUsersAccessKeyData).then(data => {
        test.assert(
          typeof data[0].accessKeys.AccessKeyMetadata[0].valid === "boolean" &&
            !data[0].accessKeys.AccessKeyMetadata[0].valid
        );
        test.assert(
          typeof data[0].accessKeys.AccessKeyMetadata[0].warning ===
            "boolean" && !data[0].accessKeys.AccessKeyMetadata[0].warning
        );
      });
    } catch (error) {
      throw error;
      done(error);
    }
  });
    it("should attach 'valid' boolean (true) and a 'warning' boolean (true) to AccessKey object", async () => {
      let mockUsersAccessKeyData = [
        {
          Path: "/",
          UserName: "user",
          UserId: "AIDAI7A3M3AUYS4CJIUFM",
          Arn: "arn:aws:iam::827046125129:user/user",
          CreateDate: new Date("2019-01-26T02:35:19.000Z"),
          PasswordLastUsed: new Date("2019-01-26T03:06:00.000Z"),
          accessKeys: {
            ResponseMetadata: {
              RequestId: "966b3928-2a20-11e9-b998-9f3964ebcb2b"
            },
            AccessKeyMetadata: [
              {
                UserName: "user",
                AccessKeyId: "AKIAJFNVEKKUJKY5DO4Q",
                Status: "Active",
                CreateDate: new Date("2019-02-10T14:30:10.000Z")
              }
            ],
            IsTruncated: false
          }
        }
      ];

      try {
        const Handler = rewire(
          "./handler.js"
        );
        const validateAccessKeys = Handler.__get__(
          "validateAccessKeys"
        );

        const accessKeyCreateDateOlderThanWarningNewerThanValid = new Date();
        accessKeyCreateDateOlderThanWarningNewerThanValid.setDate(
          accessKeyCreateDateOlderThanWarningNewerThanValid.getDate() -
            parseInt(process.env.DAYS_VALID) +
            1
        );
        mockUsersAccessKeyData[0].accessKeys.AccessKeyMetadata[0].CreateDate = accessKeyCreateDateOlderThanWarningNewerThanValid;
        return validateAccessKeys(mockUsersAccessKeyData)
        .then(data => {
            assert(
                typeof data[0].accessKeys.AccessKeyMetadata[0].valid === "boolean" &&
                data[0].accessKeys.AccessKeyMetadata[0].valid
              );
            assert(
                typeof data[0].accessKeys.AccessKeyMetadata[0].warning ===
                  "boolean" && data[0].accessKeys.AccessKeyMetadata[0].warning
              );
          });
      } catch (error) {
        throw error;
      }
    });
    it("should attach 'valid' boolean (true) and 'warning' (false) boolean to AccessKey object", async () => {
      let mockUsersAccessKeyData = [
        {
          Path: "/",
          UserName: "user",
          UserId: "AIDAI7A3M3AUYS4CJIUFM",
          Arn: "arn:aws:iam::827046125129:user/user",
          CreateDate: new Date("2019-01-26T02:35:19.000Z"),
          PasswordLastUsed: new Date("2019-01-26T03:06:00.000Z"),
          accessKeys: {
            ResponseMetadata: {
              RequestId: "966b3928-2a20-11e9-b998-9f3964ebcb2b"
            },
            AccessKeyMetadata: [
              {
                UserName: "user",
                AccessKeyId: "AKIAJFNVEKKUJKY5DO4Q",
                Status: "Active",
                CreateDate: new Date("2019-02-10T14:30:10.000Z")
              }
            ],
            IsTruncated: false
          }
        }
      ];

      try {
        const Handler = rewire(
          "./handler.js"
        );
        const validateAccessKeys = Handler.__get__(
            "validateAccessKeys"
          );
        const accessKeyCreateDateNewerThanWarning = new Date();
        accessKeyCreateDateNewerThanWarning.setDate(
      accessKeyCreateDateNewerThanWarning.getDate() -
        parseInt(process.env.DAYS_VALID) +
        parseInt(process.env.DAYS_FOR_WARNING) +
        3
        );
      //   console.log("3:" + accessKeyCreateDateNewerThanWarning);
        mockUsersAccessKeyData[0].accessKeys.AccessKeyMetadata[0].CreateDate = accessKeyCreateDateNewerThanWarning;
        return validateAccessKeys(mockUsersAccessKeyData)
        .then(data => {
        test.assert(
          typeof data[0].accessKeys.AccessKeyMetadata[0].valid === "boolean" &&
          data[0].accessKeys.AccessKeyMetadata[0].valid
        );
        test.assert(
          typeof data[0].accessKeys.AccessKeyMetadata[0].warning ===
            "boolean" && !data[0].accessKeys.AccessKeyMetadata[0].warning
        );
        });
      } catch (error) {
        throw error;
        // done(error);
      }
    });
});
