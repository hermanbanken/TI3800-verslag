'use strict';

$(function() {

    var _ = window._;
    var raphael = window.Raphael;
    var $ = window.$;

    $('#presentation').jmpress({
        start: '#home',
        viewPort: {
            width: 1000
        }
    });

    var video = document.getElementById('thialf-video');
    $('#video').on('enterStep', function(){
        _.delay(function(){
            video.play();
        }, 2000);
    }).on('leaveStep', function(){
        _.delay(function(){
            video.pause();
            video.load();
        }, 2000);
    });

    var names = ['Herman', 'Roxanne', 'Annette', 'Hylke', 'Patrick', 'Johan'];
    var lapCount = 0;
    var $lap = $('div.lap').remove();
    var $nextLap = null;
    $('#add-lap').on('click', function(){
        var $curLap;
        if ($nextLap === null) {
            $curLap = $lap.clone().hide().prependTo($('#laps'));
            $nextLap = $lap.clone().hide().prependTo($('#laps'));
        } else {
            $curLap = $nextLap;
            $nextLap = null;
        }

        $curLap.find('.time').text(_.str.numberFormat(Math.random() * 30 + 30, 2));
        $curLap.find('.name').text(names[lapCount % names.length]);

        lapCount++;

        $curLap.slideDown(200);
    });

    var bindImage = function(step, image){
        $(step)
        .on('enterStep', function() { $(image).addClass('active'); })
        .on('leaveStep', function() { $(image).removeClass('active'); });
    };

    var steps = _.map($('.step:not([data-exclude])'), function(s){ return $(s).attr('id'); });
    $('.step')
    .on('enterStep', function() {
        var progress = steps.indexOf($(this).attr('id')) / (steps.length - 1) * 100;
        if(progress <= 100 && progress >= 0) {
            $('#presentation-progress').css('width', progress + '%');
        }
    });

    bindImage('#home', '#home-image');
    bindImage('#transponders-detectielussen', '#transponders-detectielussen-image');

    bindImage('#aggregatie-stap-1', '#aggregatie-image-1');
    bindImage('#aggregatie-stap-2', '#aggregatie-image-2');
    bindImage('#aggregatie-stap-3', '#aggregatie-image-3');
    bindImage('#aggregatie-stap-4', '#aggregatie-image-4');
    bindImage('#aggregatie-stap-5', '#aggregatie-image-5');

    /* Live Demo */

    var $button = $('<a class="btn btn-block btn-default btn-xs disabled"></a>');
    var $time = $('<a class="btn btn-block btn-xs disabled">0.00</a>');

    var $loop1ButtonContainer = $('#loop1');
    var $loop2ButtonContainer = $('#loop2');
    var $timeContainer = $('#times');

    raphael.fn.addGuides = function() {
        this.ca.guide = function(g) {
            return {
                guide: g
            };
        };
        this.ca.along = function(percent) {
            var g = this.attr('guide');
            var len = g.getTotalLength();
            var point = g.getPointAtLength(percent * len);
            var t = {
                transform: 't' + [point.x, point.y]
            };
            return t;
        };
    };

    var paper = raphael('live-people', 700, 335);
    paper.addGuides();
    var baan = paper.path('M138.872,286.986c-71.199,0-129.125-57.926-129.125-129.124c0-71.199,57.925-129.125,129.125-129.125h342.677c71.197,0,129.123,57.925,129.123,129.125c0,71.198-57.926,129.124-129.123,129.124H138.872z')
    .attr({'stroke-width': '0', 'stroke': 'red'});

    var liveUsers = window.liveUsers = [];

    var createUser = window.createUser = function(name, transponder, avgRunTime, avgRestTime) {
        var user = {
            name: name,
            transponder: transponder,
            avgRunTime: avgRunTime,
            avgRestTime: avgRestTime
        };

        user.setNextLap = function() {
            user.randomLapTime = Math.random() * 4 - 2 + (user.inRest ? user.avgRestTime : user.avgRunTime);
        };

        user.reset = function() {
            user.lastFinish = new Date((new Date()).getTime() - (user.randomLapTime * 980));
            user.update(new Date());
            user.loop1Button.removeClass('btn-warning');
            user.loop2Button.removeClass('btn-primary');
        };

        user.passing = function(now, where) {

            var url = _.str.sprintf(
                'http://vantagepractice.cloudapp.net/passing/f669f93f-16ce-43dd-99f4-2785445fed3e/%s/%s/%s',
                user.transponder, where, now.toISOString()
            );

            console.log(url);

            // return;

            $.ajax({
                url: url,
                type: 'POST',
                crossDomain: true,
                dataType: 'json'
            });
        };

        user.update = function(now) {
            user.currentTime = (now.getTime() - user.lastFinish.getTime()) / 1000;
            user.previousProgress = user.progress;
            user.progress = user.currentTime / user.randomLapTime;

            user.positionIndicator.animate({along : (2 - user.progress - 0.199) % 1}, 9, 'linear');

            if (user.currentTime > user.randomLapTime) {
                // Finish on 2
                user.loop1Button.removeClass('btn-warning');
                user.loop2Button.addClass('btn-primary');
                user.lastFinish = now;

                // New lap
                user.setNextLap();
                user.lapsLeft--;
                if(user.lapsLeft === 0) {
                    user.lapsLeft = Math.floor(2 + Math.random() * 4);
                    user.inRest = !user.inRest;
                }
                user.passing(now, 0);
            } else if (user.currentTime > 0.92 * user.randomLapTime && user.loop2Button.hasClass('btn-primary')) {
                user.loop1Button.addClass('btn-warning');
                user.loop2Button.removeClass('btn-primary');
                user.passing(now, 1);
            }

            if (user.currentTime === 0 || user.currentTime > 2) {
                user.timeLabel.removeClass('btn-default').text(_.str.numberFormat(user.currentTime, 2, '.',''));
            } else {
                user.timeLabel.addClass('btn-default');
            }
        };

        user.loop1Button = $button.clone().text(name).appendTo($loop1ButtonContainer);
        user.loop2Button = $button.clone().text(name).appendTo($loop2ButtonContainer);

        user.positionIndicator = paper.circle(0, 0, 10).attr({fill: '#eee'});
        user.positionIndicator.attr({guide : baan, along : 1})
            .animate({along : 1 - 0.199}, 10, 'linear');

        user.timeLabel = $time.clone().appendTo($timeContainer);

        user.setNextLap();

        user.reset();

        user.lapsLeft = 2;
        user.inRest = true;

        liveUsers.push(user);
    };

    var updateLive = function() {
        var now = new Date();
        _.forEach(liveUsers, function(user){
            user.update(now);
        });
    };

    createUser('Herman', 'FX-33330', 32, 60);

    createUser('Annette', 'XX-12345', 30, 50);
    // createUser('Laurine', 'CC-12345', 30, 50);
    createUser('Roxanne', 'ZZ-54321', 30, 50);


    var liveInterval = null;
    var stopDemo = function(){
        if (liveInterval) {
            clearInterval(liveInterval);
            liveInterval = null;
        }
        _.forEach(liveUsers, function(user){
            user.reset();
        });
    };

    $('#start-demo').on('click', function(){
        if (liveInterval) {
            return;
        }
        _.forEach(liveUsers, function(user){
            user.reset();
        });
        liveInterval = setInterval(updateLive, 20);
    });

    $('#stop-demo').on('click', stopDemo);
    $('#demonstratie').on('leaveStep', stopDemo);
});
