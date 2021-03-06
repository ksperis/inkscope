/**
 * Created by Alain Dechorgnat on 12/13/13.
 */

var StatusApp = angular.module('StatusApp', ['D3Directives'])
    .filter('bytes', funcBytesFilter);

StatusApp.controller("statusCtrl", function ($scope, $http) {
    var apiURL = '/ceph-rest-api/';
    $scope.journal = [];
    //refresh data every x seconds
    refreshData();
    refreshPGData();
    setInterval(function () {
        refreshData()
    }, 3 * 1000);
    setInterval(function () {
        refreshPGData()
    }, 10 * 1000);

    function refreshPGData() {
        $scope.date = new Date();
        $http({method: "get", url: apiURL + "pg/stat.json"})
            .success(function (data, status) {
                var nodeUid = 0;
                // fetching pg list and relation with osd
                var pg_stats = data.output.pg_stats;

                var nbPools = data.output.pool_stats.length;
                var pools = [];
                for (var i = 0; i < nbPools; i++) {
                    pools[data.output.pool_stats[i].poolid] = true;
                }
                for (var i = 0; i < pg_stats.length; i++) {
                    var pg = pg_stats[i];
                    //console.log(pg.pgid + " : " + pg.state)
                    if (pg.state != "active+clean") {
                        //console.log("unclean : " + pg.pgid + " : " + pg.state)
                        var numPool = pg.pgid.split(".")[0];
                        pools[numPool] = false;
                    }
                }

                $scope.cleanPools = 0;
                for (var i in pools) {
                    if (pools[i] == true) $scope.cleanPools++;
                }
                $scope.uncleanPools = nbPools - $scope.cleanPools;
                $scope.pools = nbPools;
            });
    };

    function refreshData() {
        //console.log("refreshing data...");
        $scope.date = new Date();
        $http({method: "get", url: apiURL + "status.json"})
            .success(function (data) {
                $scope.pgmap = data.output.pgmap;
                $scope.percentUsed = $scope.pgmap.bytes_used / $scope.pgmap.bytes_total;
                $scope.pgsByState = $scope.pgmap.pgs_by_state;

                $scope.health = {};
                $scope.health.severity = data.output.health.overall_status;
                if (data.output.health.summary[0])
                    $scope.health.summary = data.output.health.summary[0].summary;
                else $scope.health.summary = "OK";

                historise();

                $scope.mons = data.output.monmap.mons;

                for (var i = 0; i < $scope.mons.length; i++) {
                    var mon = $scope.mons[i];
                    mon.health = "HEALTH_UNKNOWN"; // default for styling purpose
                    mon.quorum = "out";          // default for styling purpose
                    for (var j = 0; j < data.output.quorum_names.length; j++) {
                        if (mon.name == data.output.quorum_names[j]) {
                            mon.quorum = "in";
                            break
                        }
                    }
                    if (data.output.health.timechecks.mons) //not always defined
                        for (var j = 0; j < data.output.health.timechecks.mons.length; j++) {
                            mon2 = data.output.health.timechecks.mons[j];
                            if (mon.name == mon2.name) {
                                for (key in mon2) mon[key] = mon2[key];
                                break
                            }
                        }
                    for (var j = 0; j < data.output.health.health.health_services[0].mons.length; j++) {
                        mon2 = data.output.health.health.health_services[0].mons[j];
                        if (mon.name == mon2.name) {
                            for (key in mon2) mon[key] = mon2[key];
                            break
                        }
                    }
                }


                var osdmap = data.output.osdmap.osdmap;
                $scope.osdsUp = osdmap.num_up_osds;
                $scope.osdsIn = parseInt(osdmap.num_in_osds);
                $scope.osdsOut = osdmap.num_osds - osdmap.num_in_osds;
                $scope.osdsDown = $scope.osdsIn - $scope.osdsUp + $scope.osdsOut;

                $scope.osdsInUp = $scope.osdsUp;
                $scope.osdsInDown = $scope.osdsDown;
                $scope.osdsOutUp = $scope.osdsOut;
                $scope.osdsOutDown = "";

            })
            .error(function (data) {
                $scope.health = {};
                $scope.health.severity = "HEALTH_WARN";
                $scope.health.summary = "Status not available";
            });
    }

    $scope.badgeClass = function (type, count) {
        if ((count == 0) || (count + "" == "undefined"))
            return "health_status_HEALTH_UNKNOWN mybadge";
        else
            return "health_status_HEALTH_" + type + " mybadge";
    }

    function historise() {
        if ($scope.last_health_summary + "" == "undefined") {
            $scope.last_health_summary = $scope.health.summary;
            $scope.journal.push({"date": new Date(), "summary": $scope.health.summary});
            return;
        }
        if ($scope.last_health_summary != $scope.health.summary) {
            $scope.journal.push({"date": new Date(), "summary": $scope.health.summary});
            $scope.last_health_summary = $scope.health.summary;
        }
    }

});

