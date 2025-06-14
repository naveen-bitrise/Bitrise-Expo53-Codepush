An Example React Native Expo Project that uses Bitrise CodePush Server

### Setup

## Create a Bitrise Project

In Bitrise add a project and use this repository as the source (you can fork the repository to your account if needed). After the project is created, [switch the yaml source](https://devcenter.bitrise.io/en/builds/configuration-yaml/managing-an-app-s-bitrise-yml-file.html#storing-the-bitrise-yml-file-in-your-repository) to the repository. The workflows/pipeline defined in bitrise.yml will be shown in Bitirse.
1. `release` pipeline that builds the release packages for ios and android
2. `codepush_update_deploy` workflow that generates the update bundles and uploads to Bitrise CodePush Server
3. `ios_simulator` workflow that generates the app bundle for ios simulator

## Bitrise CodePush Server Setup

1. [Create connected apps](https://devcenter.bitrise.io/en/release-management/getting-started-with-release-management/adding-a-new-app-to-release-management.html) in Release Management, one for ios and another for android. You will see the connected app id in the url of the connect app page. 
2. Set the connected app id [environment variables](https://devcenter.bitrise.io/en/builds/environment-variables.html#setting-an-env-var-in-the-workflow-editor) in Bitirse CI
    * IOS_CONNECTED_APP_ID
    * ANDROID_CONNECTED_APP_ID
2. For each, create a CodePush Deployment: you can [use the API](https://api.bitrise.io/release-management/api-docs/index.html#/CodePush%20-%20Deployments/CreateCodePushDeployment) to do that.
   You would need:
   * connected-app-id from step 1
   * A [personal access token](https://devcenter.bitrise.io/en/accounts/personal-access-tokens.html) or [workspace api token](https://devcenter.bitrise.io/en/workspaces/workspace-api-token.html)
   * Choose an appropriate name for the deployment
```
 curl -X 'POST' \
  'https://api.bitrise.io/release-management/v1/connected-apps/<connected-app-id>/code-push/deployments' \
  -H 'accept: application/json' \
  -H 'authorization: <access-token> \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "prod"
  }'

```
3. Create the following [secrets in Bitrise](https://devcenter.bitrise.io/en/builds/secrets.html)
   * IOS_CODEPUSH_DEPLOYMENT_KEY - set it to `key` from the response in step 2 for ios app
   * ANDROID_CODEPUSH_DEPLOYMENT_KEY - set it to `key` from the response in step 2 for android app
   * BITRISE_API_TOKEN - set it to the value to the personal access token or workspace api token used in step 2
4. The `id` from response in step 2 has to be set as the value for [Bitirse env variables](https://devcenter.bitrise.io/en/builds/environment-variables.html#setting-an-env-var-in-the-workflow-editor).
   * IOS_PROD_DEPLOYMENT_ID
   * ANDROID_PROD_DEPLOYMENT_ID


## Creating a new Release
1. Create a new Pull Request with `main` branch as destination branch. Check to make sure the `version` has been set correctly in `app.config.js`
2. Add a `release` tag to the PR
3. This will trigger the `release` pipeline in bitrise and create a ios and android release

## Creating & Releasing CodePush Updates
1. Create an `updates` branch that is a clone of `main` branch (if one doesn't exist already)
2. Create a new Pull Request with `updates` branch as destination
3. Add `release-update` tag to the PR
4. This will trigger the `codepush_update_deploy` workflow. The workflow will
   1. create an update package for ios
   2. upload the ios update package to Bitrise CodePush Server
   3. create an update package for android
   4. upload the android updated package to Bitrise CodePush Server