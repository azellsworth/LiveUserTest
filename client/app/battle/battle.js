angular.module('battlescript.battle', [])

.controller('BattleController', function($scope, $timeout, Battle, SocketHolder) {
  
  ////////////////////////////////////////////////////////////
  // init players
  ////////////////////////////////////////////////////////////

  $scope.playerTwo = "...";
  $scope.playerOne = SocketHolder.playerOne;

  ////////////////////////////////////////////////////////////
  // open up socket and handle socket events
  ////////////////////////////////////////////////////////////

  var socket = SocketHolder.socket;

  socket.emit('matchReady');

  socket.emit('updateUsers');


  socket.on('userList', function(userArray){
    // THIS WILL ONLY WORK FOR TWO USERS RIGHT NOW
    // loop over array looking for other users
    if (userArray.length === 1){
      $scope.playerTwo = "...";
    }
    userArray.forEach(function(name){
      if(name !== $scope.playerOne){
        $scope.playerTwo = name;    
        $scope.$apply();
      }
    });
    // set other user to player2 variable
    // if only one user, don't change player 2
  });

  // What this does is when someone goes on a different page, it disconnects the "user"
  // So, it emits the event disconnect user
  $scope.$on('$routeChangeStart', logout);

  // This does the same, for refresh. Now go to socket handler for more info
  window.onbeforeunload = function(e) {
    logout();
  };
  
  // Logout on back button
  window.addEventListener("hashchange", logout)

  var logout = function(){
    socket.emit('updateUsers');
    socket.emit('disconnectedClient', {username: $scope.playerOne});
  }





  ////////////////////////////////////////////////////////////
  // configure both editors and wire them to socket
  ////////////////////////////////////////////////////////////

  // set up buttons
  $scope.playerOneButtonAttempt = 'Attempt Solution';
  $scope.playerOneButtonSubmitFinal = 'Submit Final';
  $scope.playerOneNotes = null;

  $scope.playerTwoButtonAttempt = 'Attempt Solution';
  $scope.playerTwoButtonSubmitFinal = 'Submit Final';
  $scope.playerTwoNotes = null;

  // set up editor 1
  var editor1 = CodeMirror.fromTextArea(document.querySelector('#editor1'), {
    mode: 'javascript',
    theme: 'material',
    indentUnit: 2,
    tabSize: 2,
    lineNumbers: true,
    matchBrackets: true,
    autoCloseTags: true,
    autoCloseBrackets: true
  });

  // set up editor 2
  var editor2 = CodeMirror.fromTextArea(document.querySelector('#editor2'), {
    mode: 'javascript',
    theme: 'material',
    indentUnit: 2,
    tabSize: 2,
    lineNumbers: true,
    matchBrackets: true,
    autoCloseTags: true,
    autoCloseBrackets: true,
    readOnly: 'nocursor'
  });

  // list for changes on editor
  editor1.on('change', function(e) {
    socket.emit('textChange', editor1.getValue());
  });

  // 
  socket.emit('getUsers');
  socket.on('userList', function(userArray){
    // THIS WILL ONLY WORK FOR TWO USERS RIGHT NOW
    // loop over array looking for other users
    userArray.forEach(function(name){
      if(name !== $scope.playerOne){
        $scope.playerTwo = name;    
        $scope.$apply();
      }
    });
    // set other user to player2 variable
    // if only one user, don't change player 2
  });

  socket.on('updateEnemy', function(text){
    editor2.setValue(text);
  });

  socket.on('loseMessage', function(data){
    alert('dammit. the enemy got the answer.');
  })



  ////////////////////////////////////////////////////////////
  // stuff to handle the waiting on both players
  ////////////////////////////////////////////////////////////
  
  // initial battle wait time when two players enter battle room
  $scope.battleWaitTime = 300000;

  // updates the battle wait time
  $scope.updateBattleWaitTime = function() {
    if ($scope.battleWaitTime === 0) {
      // we've timed out, need to do something...
    } else {
      $timeout(function() {
        $scope.battleWaitTime = $scope.battleWaitTime - 1000;
        $scope.updateBattleWaitTime();
      }, 1000);
    }
  };

  // call func immediately
  $scope.updateBattleWaitTime();





  ////////////////////////////////////////////////////////////
  // handle when both players are ready
  ////////////////////////////////////////////////////////////
  
  // set up player one states
  $scope.playerOneReadyState = false;
  $scope.playerOneReadyClass = '';
  $scope.playerOneReadyText = 'Waiting on you';

  $scope.updatePlayerOneReadyState = function() {
    if ($scope.playerOneReadyState === false) {
      $scope.playerOneReadyState = true;
      $scope.playerOneReadyClass = 'active';
      $scope.playerOneReadyText = 'Ready for battle!';

      socket.emit('playerOneReady');

      $scope.ifBothPlayersReady();
    }
  };

  // set up player two states
  $scope.playerTwoReadyState = false;
  $scope.playerTwoReadyClass = '';
  $scope.playerTwoReadyText = 'Waiting on opponent';

  socket.on('playerTwoReady', function() {
    if ($scope.playerTwoReadyState === false) {
      $scope.playerTwoReadyState = true;
      $scope.playerTwoReadyClass = 'active';
      $scope.playerTwoReadyText = 'Ready for battle!';
      $scope.ifBothPlayersReady();
    }
  });

  // $scope.updatePlayerTwoReadyState = function() {
  //   if ($scope.playerTwoReadyState === false) {
  //     $scope.playerTwoReadyState = true;
  //     $scope.playerTwoReadyClass = 'active';
  //     $scope.playerTwoReadyText = 'Ready for battle!';
  //     $scope.ifBothPlayersReady();
  //   }
  // };





  ////////////////////////////////////////////////////////////
  // both players ready, prepare for battle
  ////////////////////////////////////////////////////////////

  // the battle prompt loaded is initially false, and we will only udpate it
  // on success down below.
  $scope.battlePromptLoaded = false;

  // we also need to check if both players are ready, to immediately prepare
  // the battle down below
  $scope.ifBothPlayersReady = function() {
    if ($scope.playerOneReadyState && $scope.playerTwoReadyState) {
      $scope.getBattle();
    }
  };





  ////////////////////////////////////////////////////////////
  // battle logistics
  ////////////////////////////////////////////////////////////

  // first, cache some vars
  $scope.battle;
  $scope.battleDescription = null;
  $scope.battleProjectId = null;
  $scope.battleSolutionId = null;

  // fetch a battle
  $scope.getBattle = function() {
    Battle.getBattle()
      .then(function(data) {
        // battle prompt loaded is now true
        $scope.battlePromptLoaded = true;

        // set up the battle specifics
        $scope.battle = JSON.parse(data.body);
        $scope.battleDescription = $scope.battle.description;
        $scope.battleProjectId = $scope.battle.session.projectId;
        $scope.battleSolutionId = $scope.battle.session.solutionId;

        // update editors
        $timeout(function() {
          editor1.setValue($scope.battle.session.setup);
          editor2.setValue($scope.battle.session.setup);
        }, 50);

      })
      .catch(function(err) {
        console.log(err);
      });
  };






  ////////////////////////////////////////////////////////////
  // handle battle attempts
  ////////////////////////////////////////////////////////////

  $scope.attemptBattle = function($event, submitFinal) {
    $event.preventDefault();

    $scope.playerOneButtonAttempt = 'Attempting...';

    Battle.attemptBattle($scope.battleProjectId, $scope.battleSolutionId, editor1.getValue())
      .then(function(data) {
        $scope.playerOneButtonAttempt = 'Attempt Solution';

        // TODO: polling is successful at this point in time, time to send
        // and recieve the correct data
        if (data['passed']) {
          $scope.playerOneNotes = "All tests passing";
        } else {
          $scope.playerOneNotes = data.reason;
        }

        if (data['passed'] && submitFinal) {
          alert('You got the answer. Nice.');
          socket.emit('enemyAnswer');
        }
      });
  };

});
