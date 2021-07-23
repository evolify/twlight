# twlight for vscode

VSCode extension to dim code outside the current block.

### Usage:

* invoke from command panel. eg.  **`Toggle Twlight`**

* use keybind, eg.

  ```json
    {
      "key": "ctrl+z",
      "command": "twlight.toggleZenMode",
    }
  ```

  

### Feature (available command):

* #### use in normal way

  command: **`Toggle Twlight`**

  commandId: **`twlight.toggle`**

  ![image-20210723194630535](https://cdn.jsdelivr.net/gh/evolify/files@master/img/2021-07-23-image-20210723194630535.png)

  

* #### use with zen mode 

  command: **`Toggle Twlight`**

  commandId: **`twlight.toggle`**

  > Recommend use this command to replace build in zen mode.

  ![image-20210723195100950](https://cdn.jsdelivr.net/gh/evolify/files@master/img/2021-07-23-image-20210723195100950.png)



### Configuration:

* **`twlight.opacity`**:  

  The opcaity used to dim the code outside the current block, range from 0 to 1. 
