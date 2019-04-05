"use strict";

const AWS = require("aws-sdk");
const codebuild = new AWS.CodeBuild();
const cloudwatchlogs = new AWS.CloudWatchLogs();

exports.handler = (event, context, callback) => {
    console.log("Received event: " + JSON.stringify(event, null, 2));
    
    // build a map of codebuild project names
    buildListOfProjectNames([], null, function(error, projectNames) {
        if (error) {
            console.log(error, error.stack);
            callback(error);
        } else {
            console.log("Found " + projectNames.length + " projects.");
            console.log("Project names: " + projectNames);
            
            buildListOfGroupNames([], null, function(error, groupNames) {
                if (error) {
                    console.log(error, error.stack);
                    callback(error);
                } else {
                    console.log("Found " + groupNames.length + " log groups.");
                    console.log("Log group names: " + groupNames);
                    
                    var groupsProcessed = 0;
                    var groupsIgnored = 0;
                    var groupsDeleted = 0;
                    var groupsFailed = 0;
                    
                    // iterate through log groups and look for associated codebuild project
                    for (let i = 0; i < groupNames.length; i++) {
                     
                        // strip prefix from group name
                        let projectName = groupNames[i].substring(15);
                        
                        // look for name in list of functions
                        var projectExists = projectNames.includes(projectName);
                        
                        // if missing, delete the log group
                        if (projectExists) {
                            groupsIgnored++;
                            groupsProcessed++;
                            console.log("Ignoring group " + groupNames[i] + " as the CodeBuild project exists");
                        } else {
                            console.log("Deleting group " + groupNames[i] + " as the CodeBuild project no longer exists...");
                            
                            var deleteGroupParams = {
                                logGroupName: groupNames[i]
                            };
                            cloudwatchlogs.deleteLogGroup(deleteGroupParams, function(error) {
                                groupsProcessed++;
                                
                                if (error) {
                                    groupsFailed++;
                                } else {
                                    groupsDeleted++;
                                }
                                
                                // if all groups have been processed, call the main callback with results
                                if (groupsProcessed == groupNames.length) {
                                    let result = {
                                        groupsProcessed: groupsProcessed,
                                        groupsIgnored: groupsIgnored,
                                        groupsDeleted: groupsDeleted,
                                        groupsFailed: groupsFailed
                                    };
                                    console.log("Returning result: " + JSON.stringify(result, null, 2));
                                    callback(null, result);
                                }
                            });
                        }
                    }
                }
            });
        }
    });
};

var buildListOfProjectNames = function(projectNames, nextToken, projectNamesCallback) {
    
    let listProjectsParams = {};
    
    if (nextToken) {
        listProjectsParams.nextToken = nextToken;
    }
    
    // console.log("Calling listFunctions with params: " + JSON.stringify(listFunctionsParams, null, 2));
    codebuild.listProjects(listProjectsParams, function(error, data) {
        if (error) {
            console.log(error, error.stack);
            projectNamesCallback(error);
        } else {
            // console.log("Found " + data.projects.length + " projects.");
            // console.log("listProjects result: " + JSON.stringify(data, null, 2));
            
            for (var i = 0; i < data.projects.length; i++) {
                projectNames.push(data.projects[i]);
            }
            
            if (data.nextToken) {
                buildListOfProjectNames(projectNames, data.nextToken, projectNamesCallback);
            } else {
                projectNamesCallback(null, projectNames);
            }
        }
    });
};

var buildListOfGroupNames = function(groupNames, nextToken, logGroupNamesCallback) {
    
    let describeLogGroupsParams = {
        logGroupNamePrefix: "/aws/codebuild/",
        limit: 25
    };
    
    if (nextToken) {
        describeLogGroupsParams.nextToken = nextToken;
    }
    
    // console.log("Calling describeLogGroups with params: " + JSON.stringify(describeLogGroupsParams, null, 2));
    cloudwatchlogs.describeLogGroups(describeLogGroupsParams, function(error, data) {
        if (error) {
            console.log(error, error.stack);
            logGroupNamesCallback(error);
        } else {
            // console.log("Found " + data.logGroups.length + " log groups.");
            // console.log("describeLogGroups result: " + JSON.stringify(data, null, 2));
            
            for (var i = 0; i < data.logGroups.length; i++) {
                groupNames.push(data.logGroups[i].logGroupName);
            }
            
            if (data.nextToken) {
                buildListOfGroupNames(groupNames, data.nextToken, logGroupNamesCallback);
            } else {
                logGroupNamesCallback(null, groupNames);
            }
        }
    });
};
