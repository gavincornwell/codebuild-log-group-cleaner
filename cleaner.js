"use strict";

const AWS = require("aws-sdk");
const codebuild = new AWS.CodeBuild();
const cloudwatchlogs = new AWS.CloudWatchLogs();

exports.handler = async (event) => {
  console.log("Received event: " + JSON.stringify(event, null, 2));

  try {
    // retrieve lists is parallel
    let results = await Promise.all([buildListOfProjectNames(), buildListOfGroupNames()]);
    let projectNames = results[0];
    let groupNames = results[1];
    console.log("Found " + projectNames.length + " functions.");
    console.log("Found " + groupNames.length + " log groups.");

    // do the processing and return result
    var processingResults = await processLogGroups(projectNames, groupNames);
    console.log("Returning result: " + JSON.stringify(processingResults, null, 2));
    return processingResults;
  } catch (e) {
    throw new Error("Failed to clean log groups: " + e.message);
  }
};

var buildListOfProjectNames = async () => {
  try {
    let projectNames = [];
    let nextToken = null;
    let params = {};

    do {
      if (nextToken !== null) {
        params.nextToken = nextToken;
      }
      let data = await codebuild.listProjects(params).promise();
      //console.log("listProjects response: " + JSON.stringify(data, null, 2));
      for (var i = 0; i < data.projects.length; i++) {
        projectNames.push(data.projects[i]);
      }
      nextToken = data.nextToken;
    } while (nextToken !== null && nextToken !== undefined);

    return projectNames;
  } catch (e) {
    throw e;
  }
};

var buildListOfGroupNames = async () => {
  try {
    let groupNames = [];

    let nextToken = null;
    let params = {
      logGroupNamePrefix: "/aws/codebuild/",
      limit: 25
    };

    do {
      if (nextToken !== null) {
        params.nextToken = nextToken;
      }
      let data = await cloudwatchlogs.describeLogGroups(params).promise();
      //console.log("describeLogGroups response: " + JSON.stringify(data, null, 2));
      for (var i = 0; i < data.logGroups.length; i++) {
        groupNames.push(data.logGroups[i].logGroupName);
      }
      nextToken = data.nextToken;
    } while (nextToken !== null && nextToken !== undefined);

    return groupNames;
  } catch (e) {
    throw e;
  }
};

var processLogGroups = async (projectNames, groupNames) => {
  try {
    let groupsProcessed = 0;
    let groupsIgnored = 0;
    let groupsDeleted = 0;
    let groupsFailed = 0;

    // iterate through log groups and look for associated CodeBuild project
    for (let i = 0; i < groupNames.length; i++) {
      groupsProcessed++;
      let groupName = groupNames[i];

      // strip prefix from group name
      let projectName = groupName.substring(15);

      // look for name in list of projects
      var projectExists = projectNames.includes(projectName);

      // if project is missing, delete the log group
      if (projectExists) {
        groupsIgnored++;
        console.log("Ignoring group " + groupName + " as the CodeBuild project exists");
      } else {
        console.log("Deleting group " + groupName + " as the CodeBuild project no longer exists...");

        var deleteGroupParams = {
          logGroupName: groupName
        };
        try {
          await cloudwatchlogs.deleteLogGroup(deleteGroupParams).promise();
          groupsDeleted++;
        } catch (deleteError) {
          console.log("Failed to delete group " + groupName);
          groupsFailed++;
        }
      }
    }

    // build and return result object
    return {
      groupsProcessed: groupsProcessed,
      groupsIgnored: groupsIgnored,
      groupsDeleted: groupsDeleted,
      groupsFailed: groupsFailed
    };
  } catch (e) {
    throw e;
  }
};