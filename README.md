# Validate and Log Access Keys

This solution is an all encompassing implementation containing a yml SAM template for deploying the lambda, SNS, roles and policies.

## Lambda

This code pulls all users from IAM then checks their access keys to be sure they are valid based on a specified length of time past creation date (generally 90 days).

A *valid* boolean property is added to the Access Key object defining if key is within the specified time period.

A *warning* boolean property is added to the Access Key object defining if the key is within the specified time period, but close to expiring (close is defined in an evironment variable)

### Environment Variables
* DAYS_FOR_WARNING: INTEGER - Number of days to notify that an access key is close to be expired.  Start of notification is determined by the number of DAYS_VALID minus number of DAYS_FOR_WARNING
* DAYS_VALID: INTEGER - Number of days to allow for an access key to be valid without warning that it has expired
* DEBUG: BOOLEAN - Log debug messages
* LOG: BOOLEAN - Log message sent to SNS
* LOG_PREPEND_ISSUE_NOTIFIER: STRING - Prepend to expired access key message.  Can be used for filtering as needed
* LOG_PREPEND_WARNING_NOTIFIER: STRING - Prepend to warning notification message that access is close to expiring.  Can be used for filtering as needed
* SNS_SUBJECT: STRING - SNS subject title
* SNS_TOPICARN: STRING - SNS Topic arn for sending message

### Tags
* **Name**: "validateLogUserAccessKeys Lambda" - Lambda function name
* **Environment**: "Dev" -  Used as a visual cue for lambda deployment

## SAM Parameters
The *sam* yml takes two parameters:
* topic name: The SNS topic name that should be used to send the message
* email: The email that the SNS topic will send notifications too
