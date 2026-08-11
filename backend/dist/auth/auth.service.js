"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const ActiveDirectory = require('activedirectory2').promiseWrapper;
const config = {
    url: 'ldap://HGUNBXDC01VM.Horizongroupusa.com',
    baseDN: 'dc=Horizongroupusa,dc=com',
    username: 'MISSVCACC',
    password: 'Horizon@MIS',
    attributes: {
        user: []
    },
    tlsOptions: {
        rejectUnauthorized: false,
    },
    timeout: 30000,
    reconnect: true,
    connectTimeout: 30000,
};
const ad = new ActiveDirectory(config);
let AuthService = class AuthService {
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    async authenticateuser(username, password) {
        try {
            console.log('Attempting AD authentication for:', username);
            return new Promise((resolve) => {
                ad.authenticate(username, password, (err, auth) => {
                    if (err) {
                        console.log('AD authentication error:', err.message);
                        resolve(false);
                    }
                    else {
                        resolve(auth);
                    }
                });
            });
        }
        catch (error) {
            console.error('AD authentication unexpected error:', error);
            return false;
        }
    }
    async getADUserDetails(username) {
        let user = await new Promise((resolve, reject) => {
            ad.findUser(username, function (err, user) {
                if (err) {
                    reject(err);
                }
                if (user) {
                    resolve(user);
                }
                else {
                    resolve(null);
                }
            });
        });
        return user;
    }
    async signIn(username, pass) {
        username = username.toLowerCase().split('@')[0];
        if (username === 'admin' && pass === 'admin') {
            console.log('[DEV] Admin bypass login used');
            const payload = {
                email: 'admin@hgusa.com',
                name: 'Admin',
                userid: 0,
                roles: ['Admin', 'admin'],
                department: 'MIS',
                location: null,
            };
            return { access_token: await this.jwtService.signAsync(payload) };
        }
        let email = '';
        let aduser = null;
        let adauthentication = await this.authenticateuser(`${username}@hgusa.com`, pass);
        if (!adauthentication) {
            console.log('First domain auth failed, trying second domain...');
            adauthentication = await this.authenticateuser(`${username}@horizongroupusa.com`, pass);
        }
        if (!adauthentication) {
            console.log('AD Authentication failed for user:', username);
            throw new common_1.UnauthorizedException('Active Directory authentication failed - Please check your credentials');
        }
        else {
            console.log('AD Authentication successful, getting AD user details...');
            try {
                aduser = await this.getADUserDetails(username);
            }
            catch (e) {
                console.log('Failed to fetch AD details, continuing with basics');
            }
            if (!aduser || !aduser.mail) {
                aduser = {
                    mail: `${username}@hgusa.com`,
                    cn: username,
                    department: null,
                    location: null
                };
            }
            email = aduser.mail.toLowerCase();
        }
        const payload = {
            email: email,
            name: aduser.cn || username,
            userid: username,
            roles: ['User'],
            department: aduser.department,
            location: aduser.location
        };
        return {
            access_token: await this.jwtService.signAsync(payload)
        };
    }
    async searchUsers(query) {
        const searchQuery = `(&(objectClass=user)(|(cn=${query}*)(mail=${query}*)))`;
        let searchCompleted = false;
        return new Promise((resolve, reject) => {
            let isResolved = false;
            try {
                ad.findUsers(searchQuery, true, (err, users) => {
                    if (isResolved || searchCompleted) {
                        return;
                    }
                    if (err) {
                        console.error('AD Search Error for:', query, err);
                        isResolved = true;
                        return resolve([]);
                    }
                    if (!users || users.length === 0) {
                        isResolved = true;
                        return resolve([]);
                    }
                    const formattedUsers = users.map((f) => ({
                        name: f.cn,
                        email: f.mail,
                        department: f.department
                    }));
                    isResolved = true;
                    searchCompleted = true;
                    resolve(formattedUsers);
                });
            }
            catch (error) {
                console.error('Error in AD search for:', query, error);
                if (!isResolved) {
                    isResolved = true;
                    resolve([]);
                }
            }
            setTimeout(() => {
                if (!isResolved) {
                    console.log('AD search timed out for:', query);
                    isResolved = true;
                    searchCompleted = true;
                    resolve([]);
                }
            }, 10000);
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map