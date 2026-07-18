# Authenticated mobile UX audit baseline

Private PNGs are optional local context and are intentionally ignored. This tracked manifest is the reproducible inventory; it contains no names, session data, or visible values. Hashes are SHA-256 of the 2026-07-14 captures. Most early captures used the audit browser's 375px full-page mode; release acceptance remains only 390x844 and 430x932.

| file | sha256 | dimensions | route | state / non-PII observation |
| --- | --- | --- | --- | --- |
| `01-home-mobile.png` | `e95e600ce24841e7f80d1999c5b93baeb9c6a480ea14c5223d89d874c0aa1f9d` | 375x1490 | `/` | authenticated dense home |
| `02-profile.png` | `325bbe5d9a2f749cf2fe6debcdc7c53cc689be9ba28d507c5aa81136045187fc` | 375x876 | `/profile` | basic profile tab |
| `03-settlement.png` | `6da9c64ea9f0d7adeeb0ce939eae31dfb36d31339aefc2225d30dd28736b8dac` | 390x844 | `/settlement` | personal settlement entry |
| `04-meeting-create.png` | `c14a0e73ffe4b7e533956ea34b6e1f66e0279d65495a5fa486fa6930a59fe200` | 375x863 | `/meeting/create` | authenticated create form |
| `05-meeting-9.png` | `7b4586ea554da39705117dd0a83b3a1e68f747c5fe3c97dc06e2f99321172e7f` | 375x1076 | `/meeting/9` | compatibility redirect destination loading |
| `05b-meeting-9-loaded.png` | `c01f456534db6880e71321eea6acd19cbe6a645a4c00bffefc2fc3277246b0c6` | 375x1284 | `/?date=<fixture-date>` | redirected meeting loaded |
| `06-signup-confirm.png` | `92caa3a14c3ed5268d2d1d47676a20fe657df49ae9828f4880f82bcb1e58569a` | 390x844 | `/signup/confirm` | confirmation compatibility state |
| `07-admin-login.png` | `992f7201ac845537d49c8b21946da7f18181e5ce319b0ab4c1b091045ee88869` | 375x2220 | `/admin/login` | admin auto-login transition |
| `08-admin-dashboard.png` | `992f7201ac845537d49c8b21946da7f18181e5ce319b0ab4c1b091045ee88869` | 375x2220 | `/admin` | dashboard transition duplicate capture |
| `09-admin-members.png` | `0dbcd59c1ca79084b3c35c10868c89d2074dbcbbac155e1484d6f0e84c48af0a` | 375x3296 | `/admin/members` | dense 35-row member list |
| `10-admin-meetings.png` | `1660aeb4db6aa6aa16cd658f8cc905d394fecfe4590a9de07a8fed187e7a7f28` | 375x1072 | `/admin/meetings` | meeting list |
| `11-admin-meeting-9.png` | `fe03e72c793ca3ad1cd35a9b10121e31a1d75ee24af5dc2243cb11115c9eca1a` | 375x3420 | `/admin/meetings/9` | dense detail tabs |
| `12-admin-orders-9.png` | `ebec88bf28ffb79eb92351fefa8d6fb4dafb58084d57319c9158f3bfeda898c4` | 375x10267 | `/admin/meetings/9/orders` | 60-row catalog-oriented order board |
| `13-admin-settlement-9.png` | `f0afc0b2d9ff4c35be3280bc18b9e0403735accf286c0374bfaec832d758a716` | 375x1880 | `/admin/meetings/9/settlement` | settlement recipients and totals |
| `14-admin-menus.png` | `2e4709e0d415924d230e6b0b08b5b3fc28e6e1f1ab34a57c8c5149655bab1e4d` | 375x7672 | `/admin/menus` | full catalog editor |
| `15-admin-pricing.png` | `c3157ba872048fe9d5a01c25d9130fe2e2ba94b476eb538f5412ea34394f696d` | 375x2246 | `/admin/pricing` | pricing form |
| `16-admin-settings.png` | `9e2acb21599a5c109f2e550b8d0f8f8046ae85d7a59380392df734c65d1afc30` | 375x1943 | `/admin/settings` | settings form |
| `17-shop-dashboard.png` | `8bfe11b91c9264cde5c4d993c892271a619e49b918db878204c4673a3d7498fe` | 390x844 | `/shop` | shop landing before meeting load |
| `18-shop-usage.png` | `06b720dd7049542a5756e9be5f810aa6e544aef7d8b5796175c73434db77ec9b` | 375x3687 | `/shop/usage` | usage page default state |
| `19-shop-menus.png` | `210bd5eb825339ccac1a8de51b118c59071f2b37f8cbb91ae9ad51f59f10b9ec` | 375x7601 | `/shop/menus` | shared full catalog editor |
| `20-home-return.png` | `e95e600ce24841e7f80d1999c5b93baeb9c6a480ea14c5223d89d874c0aa1f9d` | 375x1490 | `/` | return navigation duplicate capture |
| `21-home-signup-status.png` | `1bd8da8715402e50aae82d230c2964797da70ba0b1bc94eab55a7ff0f3b2a039` | 375x1983 | `/` | participant status expanded |
| `22-home-settlement-tab.png` | `0f5e1cd89520657d09c8ac3b53a08dd4a91b5868bf1f7bbd77a5314bf0a55469` | 390x844 | `/` | settlement tab loading |
| `22b-home-settlement-loaded.png` | `ebf76e5db82e0c3c296dbc1ea36c07389d587cf69ceb025e4f464301f2a1bac9` | 375x2051 | `/` | settlement tab loaded |
| `23-home-alert-center.png` | `5a053da1841d1489bb576c2bbd84d28e119c5daf5ebb1fc0fedca1a30c3300bb` | 375x2051 | `/` | unbounded alert-center overlay |
| `24-admin-member-edit.png` | `02f83f4f8adac22a2d9d42d8f937a13c27dedd53e4ab47e6ac0e57a968908638` | 375x3421 | `/admin/members` | member edit mode |
| `25-shop-orders-meeting9.png` | `bce1d80a9e73128415d041655dc58b089348226324ed9736b8c67a53e3025c77` | 375x4546 | `/shop?meetingId=9` | completed dense order list |
| `26-shop-usage-meeting9.png` | `9dd9a9f7b20cc2d389d0ab1d653bc222235508d11e5fa5a51d52639a721517ad` | 375x11380 | `/shop/usage?meetingId=9` | dense participant usage steppers |
| `27-profile-companions.png` | `bdb50de44c5f10762783458f07576318897b4f07bd56a233b2b98fb144b9a95e` | 375x876 | `/profile` | companion tab |
| `28-admin-member-detail-loaded.png` | `b15ba30c154e34eb114eef2413ded7af91b2155e2601c7737015665ff0cfb0ad` | 375x3785 | `/admin/members` | member detail expanded |
| `29-admin-meeting-cancelled-tab.png` | `6db3829a2fe627741d01fcfbb0a3df422936e683b7f27fd1a38ec904331c92aa` | 375x862 | `/admin/meetings/9` | cancelled participant tab |
| `30-shop-order-cancel-dialog.png` | `bce1d80a9e73128415d041655dc58b089348226324ed9736b8c67a53e3025c77` | 375x4546 | `/shop?meetingId=9` | pre-dialog duplicate capture |
| `30b-shop-order-cancel-dialog.png` | `b28914cd62590c5b7419ff88dee030b1e6ad29ae96660eea268fa72d19e45b3b` | 390x844 | `/shop?meetingId=9` | cancellation dialog open |
| `31-admin-orders-desktop-1280.png` | `9e92226f8b4b8f9b7131e6382e445d3162385638889058bd8dc90f4fd10b325f` | 1280x900 | `/admin/meetings/9/orders` | diagnostic proof of intentional 430px shell; not release viewport |

Count: 34 PNG rows. Catalog observation: 37 total menus, 36 active, 60 active selectable variants.
